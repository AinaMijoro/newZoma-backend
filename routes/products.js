
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const Product = require("../models/products");
const Activity = require("../models/activities");
const User = require("../models/users");

// Enregistrer plusieurs offres pour une activité
router.post("/", async (req, res) => {
    try {
        const { activityId, userId, products } = req.body;

        if (
            !mongoose.isValidObjectId(activityId) ||
            !mongoose.isValidObjectId(userId) ||
            !Array.isArray(products) ||
            products.length === 0
        ) {
            return res.status(400).json({
                message: "Activité, prestataire ou offres invalides.",
            });
        }

        const activity = await Activity.findById(activityId);

        if (!activity) {
            return res.status(404).json({ message: "Activité introuvable." });
        }

        if (String(activity.userId) !== String(userId)) {
            return res.status(403).json({
                message: "Cette activité ne vous appartient pas.",
            });
        }

        const user = await User.findById(userId);

        if (!user || !user.profiles.includes("propose")) {
            return res.status(403).json({
                message: "Seuls les prestataires peuvent enregistrer des offres.",
            });
        }

        const invalidProduct = products.some(
            (product) =>
                !product.name?.trim() ||
                !product.description?.trim() ||
                product.price === "" ||
                product.price === null ||
                product.price === undefined ||
                !Number.isFinite(Number(product.price)) ||
                Number(product.price) < 0
        );

        if (invalidProduct) {
            return res.status(400).json({
                message: "Chaque offre doit avoir un nom, une description et un prix valide.",
            });
        }


        const createdProducts = await Product.insertMany(
            products.map((product) => ({
                activityId,
                userId,
                name: product.name.trim(),
                description: product.description.trim(),
                price: Number(product.price),
                currency: product.currency === "MGA" ? "MGA" : "EUR",
            }))
        );


        return res.status(201).json({
            message: "Offres enregistrées avec succès.",
            products: createdProducts,
        });
    } catch (error) {
        console.error("Erreur lors de l'enregistrement des offres :", error);
        return res.status(500).json({
            message: "Erreur serveur lors de l'enregistrement des offres.",
        });
    }
});

// Récupérer les offres d'une activité
router.get("/activity/:activityId", async (req, res) => {
    try {
        const { activityId } = req.params;

        if (!mongoose.isValidObjectId(activityId)) {
            return res.status(400).json({ message: "Identifiant invalide." });
        }

        const activity = await Activity.findById(activityId);

        if (!activity) {
            return res.status(404).json({ message: "Activité introuvable." });
        }

        const products = await Product.find({ activityId }).sort({
            createdAt: -1,
        });

        return res.json({ products });
    } catch (error) {
        console.error("Erreur lors de la récupération des offres :", error);
        return res.status(500).json({
            message: "Erreur serveur lors de la récupération des offres.",
        });
    }
});
// Récupérer toutes les offres d'un prestataire
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({
                message: "Identifiant utilisateur invalide.",
            });
        }

        const products = await Product.find({ userId })
            .populate("activityId", "name specialty")
            .sort({ createdAt: -1 });

        return res.json({ products });
    } catch (error) {
        console.error(
            "Erreur lors de la récupération des offres du prestataire :",
            error
        );

        return res.status(500).json({
            message: "Erreur serveur lors de la récupération des offres.",
        });
    }
});
module.exports = router;
