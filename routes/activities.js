
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Activity = require('../models/activities');
const User = require('../models/users');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const validCountries = ['France', 'Madagascar'];
const validParcelDirections = [
  'france_to_madagascar',
  'madagascar_to_france'
];
const validDeliveryTypes = [
  'free',
  'free_over_minimum',
  'flat_fee',
  'none'
];

function isStringArray(value) {
  return Array.isArray(value) &&
    value.every(item =>
      typeof item === 'string' && item.trim().length > 0
    );
}

// Enregistrer une nouvelle activité
router.post('/', async (req, res) => {
  try {
    const {
      userId,
      name,
      specialty,
      countries,
      frenchDepartments = [],
      frenchCities = [],
      madagascarCities = [],
      parcelDirections = [],
      delivery
    } = req.body;

    
const checks = {
  userIdString: typeof userId === 'string',
  userIdValid: mongoose.Types.ObjectId.isValid(userId),
  nameValid: typeof name === 'string' && !!name.trim(),
  specialtyValid: typeof specialty === 'string' && !!specialty.trim(),
  countriesValid:
    Array.isArray(countries) &&
    countries.length > 0 &&
    countries.every(country => validCountries.includes(country)) &&
    new Set(countries).size === countries.length,
  frenchDepartmentsValid: isStringArray(frenchDepartments),
  frenchCitiesValid: isStringArray(frenchCities),
  madagascarCitiesValid: isStringArray(madagascarCities),
  parcelDirectionsValid:
    Array.isArray(parcelDirections) &&
    parcelDirections.every(direction =>
      validParcelDirections.includes(direction)
    ) &&
    new Set(parcelDirections).size === parcelDirections.length,
  deliveryTypeValid:
    !!delivery && validDeliveryTypes.includes(delivery.type)
};

console.log("ACTIVITY VALIDATION:", checks);

if (Object.values(checks).some(valid => !valid)) {
  return res.status(400).json({
    message: 'Vérifie les informations obligatoires de ton activité.'
  });
}


    if (
      (frenchDepartments.length > 0 || frenchCities.length > 0) &&
      !countries.includes('France')
    ) {
      return res.status(400).json({
        message: 'Les départements et villes français nécessitent la sélection de la France.'
      });
    }

    if (
      madagascarCities.length > 0 &&
      !countries.includes('Madagascar')
    ) {
      return res.status(400).json({
        message: 'Les villes malgaches nécessitent la sélection de Madagascar.'
      });
    }

    if (parcelDirections.length > 0 &&
        !(countries.includes('France') && countries.includes('Madagascar'))) {
      return res.status(400).json({
        message: 'Pour proposer un envoi entre les deux pays, sélectionne la France et Madagascar.'
      });
    }

    if (
      delivery.type === 'free_over_minimum' &&
      (!Number.isFinite(delivery.minimumAmount) || delivery.minimumAmount < 0)
    ) {
      return res.status(400).json({
        message: 'Indique un montant minimum valide pour la livraison gratuite.'
      });
    }

    if (
      delivery.type === 'flat_fee' &&
      (!Number.isFinite(delivery.fee) || delivery.fee < 0)
    ) {
      return res.status(400).json({
        message: 'Indique des frais de livraison valides.'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'Utilisateur introuvable.'
      });
    }

    if (!user.profiles.includes('propose')) {
      return res.status(403).json({
        message: 'Ce compte ne possède pas le profil « Je propose ».'
      });
    }

    const activity = await Activity.create({
      userId,
      name: name.trim(),
      specialty: specialty.trim(),
      countries,
      frenchDepartments: frenchDepartments.map(item => item.trim()),
      frenchCities: frenchCities.map(item => item.trim()),
      madagascarCities: madagascarCities.map(item => item.trim()),
      parcelDirections,
      delivery: {
        type: delivery.type,
        ...(delivery.type === 'free_over_minimum'
          ? { minimumAmount: delivery.minimumAmount }
          : {}),
        ...(delivery.type === 'flat_fee'
          ? { fee: delivery.fee }
          : {})
      }
    });

    return res.status(201).json({
      message: 'Activité enregistrée. Elle est en attente de validation.',
      activity
    });
  } catch (error) {
    console.error('Erreur enregistrement activité :', error.message);

    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        message: 'Certaines informations de l’activité sont invalides.'
      });
    }

    return res.status(500).json({
      message: 'Une erreur est survenue lors de l’enregistrement de l’activité.'
    });
  }
});
// Récupérer les activités en attente de validation
router.get('/pending', requireAuth, requireAdmin, async (req, res) => {
  try {
    const activities = await Activity.find({ status: 'pending' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ activities });
  } catch (error) {
    console.error(
      'Erreur récupération activités en attente :',
      error.message
    );

    return res.status(500).json({
      message: 'Impossible de récupérer les activités en attente.'
    });
  }
});
// Approuver une activité
router.patch('/:activityId/approve', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { activityId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(activityId)) {
      return res.status(400).json({
        message: 'Identifiant d’activité invalide.'
      });
    }

    const activity = await Activity.findOneAndUpdate(
      { _id: activityId, status: 'pending' },
      { $set: { status: 'approved' } },
      { new: true, runValidators: true }
    );

    if (!activity) {
      return res.status(404).json({
        message: 'Activité introuvable ou déjà traitée.'
      });
    }

    return res.status(200).json({
      message: 'Activité approuvée avec succès.',
      activity
    });
  } catch (error) {
    console.error('Erreur approbation activité :', error.message);

    return res.status(500).json({
      message: 'Impossible d’approuver cette activité.'
    });
  }
});
 // Récupérer les activités approuvées pour la recherche
router.get('/', async (req, res) => {
  try {
    const activities = await Activity.find({ status: 'approved' })
      .select(
        'name specialty countries frenchDepartments frenchCities madagascarCities parcelDirections delivery userId createdAt'
      )
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ activities });
  } catch (error) {
    console.error('Erreur récupération activités :', error.message);

    return res.status(500).json({
      message: 'Impossible de récupérer les activités pour le moment.'
    });
  }
});

module.exports = router;
