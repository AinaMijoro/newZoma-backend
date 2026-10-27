
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/users');
require('dotenv').config();

async function resetPassword() {
  try {
    const email = 'info@gmail.com';

    // Demander le nouveau mot de passe dans le terminal
   const readline = require('readline');

const password = await new Promise((resolve, reject) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true
  });

  process.stdout.write('Nouveau mot de passe temporaire : ');

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  let input = '';

  const onData = (char) => {
    const key = char.toString();

    if (key === '\r' || key === '\n') {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
      process.stdout.write('\n');
      resolve(input);
    } else if (key === '\u0003') {
      process.stdin.removeListener('data', onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
      reject(new Error('Saisie annulée.'));
    } else if (key === '\u007f' || key === '\b') {
      input = input.slice(0, -1);
    } else {
      input += key;
    }
  };

  process.stdin.on('data', onData);
});
    if (!password || password.length < 8) {
      throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
    }

    // Connexion à MongoDB avec la configuration du projet
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI est introuvable dans le fichier .env.');
    }

    await mongoose.connect(mongoUri);

    const user = await User.findOne({ email });

    if (!user) {
      throw new Error('Aucun compte trouvé pour cette adresse e-mail.');
    }

    user.password = await bcrypt.hash(password, 12);
    await user.save();

    console.log('Mot de passe mis à jour pour le compte :', user.name);
  } catch (error) {
    console.error('Erreur :', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

resetPassword();

