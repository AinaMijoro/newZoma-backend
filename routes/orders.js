
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Order = require("../models/orders");
const Product = require("../models/products");
const Activity = require("../models/activities");
const User = require("../models/users");
const { requireAuth } = require("../middleware/auth");
const { sendOrderEmail } = require("../mailer");

// Créer une commande
router.post("/", requireAuth, async (req, res) => {
    try {
        const { activityId, products } = req.body;
        const prospectId = req.user.id;

        if (
            !mongoose.isValidObjectId(activityId) ||
            !Array.isArray(products) ||
            products.length === 0
        ) {
            return res.status(400).json({
                message: "Activité ou produits invalides.",
            });
        }

        const activity = await Activity.findById(activityId);

        if (!activity || activity.status !== "approved") {
            return res.status(404).json({
                message: "Cette activité n'est pas disponible.",
            });
        }

        if (String(activity.userId) === String(prospectId)) {
            return res.status(403).json({
                message: "Vous ne pouvez pas commander auprès de votre propre activité.",
            });
        }

        const seller = await User.findById(activity.userId);

        if (!seller || !seller.email || !seller.profiles.includes("propose")) {
            return res.status(404).json({
                message: "Prestataire introuvable ou adresse e-mail indisponible.",
            });
        }

        const prospect = await User.findById(prospectId).select("name email");

        if (!prospect) {
            return res.status(404).json({
                message: "Prospect introuvable.",
            });
        }

        const productIds = products.map((item) => item.productId);

        if (
            productIds.some((id) => !mongoose.isValidObjectId(id)) ||
            new Set(productIds.map(String)).size !== productIds.length
        ) {
            return res.status(400).json({
                message: "La sélection des produits est invalide.",
            });
        }

        const databaseProducts = await Product.find({
            _id: { $in: productIds },
            activityId: activity._id,
            userId: activity.userId,
        });

        if (databaseProducts.length !== productIds.length) {
            return res.status(400).json({
                message: "Un ou plusieurs produits ne sont plus disponibles.",
            });
        }

        const databaseProductsById = new Map(
            databaseProducts.map((product) => [String(product._id), product])
        );

        const orderProducts = [];

        for (const selected of products) {
            const product = databaseProductsById.get(String(selected.productId));
            const quantity = Number(selected.quantity);

            if (!Number.isSafeInteger(quantity) || quantity < 1) {
                return res.status(400).json({
                    message: "Chaque quantité doit être un nombre entier supérieur à zéro.",
                });
            }

            orderProducts.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                currency: product.currency,
                quantity,
            });
        }

        const totalsByCurrency = {};

        for (const product of orderProducts) {
            totalsByCurrency[product.currency] =
                (totalsByCurrency[product.currency] || 0) +
                product.price * product.quantity;
        }

        const order = await Order.create({
            prospectId,
            sellerId: activity.userId,
            activityId: activity._id,
            products: orderProducts,
            totalsByCurrency,
        });
        try {
            const emailProducts = orderProducts
                .map(
                    (product) =>
                        `- ${product.name} : ${product.quantity} x ${product.price} ${product.currency}`
                )
                .join("\n");

            const emailTotals = Object.entries(totalsByCurrency)
                .map(([currency, total]) => `${total.toFixed(2)} ${currency}`)
                .join("\n");

            await sendOrderEmail({
                to: seller.email,
                subject: "Nouvelle commande reçue sur Zoma",
                text: `Bonjour,

Vous avez reçu une nouvelle commande sur Zoma.

Activité : ${activity.name}
Client : ${prospect.name || "Prospect"}
E-mail du client : ${prospect.email}

Produits commandés :
${emailProducts}

Total :
${emailTotals}

Connectez-vous à votre espace prestataire pour consulter cette commande.

L'équipe Zoma`,
            });
        } catch (emailError) {
            console.error("Erreur lors de l'envoi de l'e-mail au vendeur :", emailError);
        }

        return res.status(201).json({
            message: "Commande enregistrée avec succès.",
            order: {
                id: order._id,
                status: order.status,
                activityName: activity.name,
                prospectName: prospect.name,
                prospectEmail: prospect.email,
                sellerEmail: seller.email,
                products: order.products,
                totalsByCurrency: Object.fromEntries(order.totalsByCurrency),
                createdAt: order.createdAt,
            },
        });
    } catch (error) {
        console.error("Erreur lors de la création de la commande :", error);

        return res.status(500).json({
            message: "Erreur serveur lors de la création de la commande.",
        });
    }
});

module.exports = router;
