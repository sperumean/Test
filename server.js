const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');

// Parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: false }));

// Connect to MongoDB Atlas
const mongoURI = 'mongodb+srv://stevenperumean:ixdcxThT3GcMPtNt@cluster0.skkozx4.mongodb.net/Cluster0?retryWrites=true&w=majority';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define the reservation schema
const reservationSchema = new mongoose.Schema({
  date: Date,
  time: String,
  location: String,
  note: String
});

// Create the reservation model
const Reservation = mongoose.model('Reservation', reservationSchema);

// Serve static files from the "public" directory
app.use(express.static('public'));

// Render the reservation form
app.get('/', (req, res) => {
  res.render('index');
});

// Handle form submission
app.post('/reserve', (req, res) => {
  const { date, time, location, note } = req.body;

  // Create a new reservation
  const reservation = new Reservation({
    date,
    time,
    location,
    note
  });

  // Save the reservation to the database
  reservation.save()
    .then(() => {
      res.render('success');
    })
    .catch(err => {
      console.error('Error saving reservation:', err);
      res.render('error');
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
