
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/users');

// Inscription d'un nouvel utilisateur
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Vérifier que tous les champs sont remplis
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Le nom, l’email et le mot de passe sont obligatoires.'
      });
    }

    // Vérifier que l'email n'est pas déjà utilisé
    const existingUser = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'Cette adresse email est déjà utilisée.'
      });
    }

    // Hacher le mot de passe avant de l'enregistrer
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword
    });

    return res.status(201).json({
      message: 'Compte créé avec succès.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Cette adresse email est déjà utilisée.'
      });
    }

    console.error('Erreur inscription :', error.message);

    return res.status(500).json({
      message: 'Une erreur est survenue lors de la création du compte.'
    });
  }
});

 // Connexion d'un utilisateur existant
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'L’email et le mot de passe sont obligatoires.'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect.'
      });
    }

    const passwordIsValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordIsValid) {
      return res.status(401).json({
        message: 'Email ou mot de passe incorrect.'
      });
    }

    return res.status(200).json({
      message: 'Connexion réussie.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Erreur connexion :', error.message);

    return res.status(500).json({
      message: 'Une erreur est survenue lors de la connexion.'
    });
  }
});

router.patch('/:userId/profile', async (req, res) => {
  try {
    const { profile } = req.body;

    if (!['cherche', 'propose'].includes(profile)) {
      return res.status(400).json({
        message: 'Le profil doit être "cherche" ou "propose".'
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.userId,
      { profile },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'Utilisateur introuvable.'
      });
    }

    return res.status(200).json({
      message: 'Profil enregistré avec succès.',
      user
    });
  } catch (error) {
    console.error('Erreur enregistrement profil :', error.message);

    if (error.name === 'CastError') {
      return res.status(400).json({
        message: 'Identifiant utilisateur invalide.'
      });
    }

    return res.status(500).json({
      message: 'Une erreur est survenue lors de l’enregistrement du profil.'
    });
  }
});

module.exports = router;
