const mongoose = require('mongoose');

const connectionString = 'mongodb+srv://Aina:jXNAEXPUfkId1SsH@cluster0.uirurbd.mongodb.net/Zoma';

mongoose.connect(connectionString, { connectTimeoutMS: 2000 })
 .then(() => console.log('Database connected'))

  .catch(error => console.error(error));