const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');

// Parse URL-encoded bodies
app.use(bodyParser.urlencoded({ extended: false }));

// Set up express-session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Connect to MongoDB Atlas
const mongoURI = 'mongodb+srv://stevenperumean:ixdcxThT3GcMPtNt@cluster0.skkozx4.mongodb.net/Cluster0?retryWrites=true&w=majority';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

// Define the reservation schema
const reservationSchema = new mongoose.Schema({
  date: Date,
  time: String,
  department: String,
  contact: String,
  location: String,
  eventStartTime: String,
  pr5000Time: String,
  note: String,
  reentry: String,
  populationLimit: Boolean,
  populationDesc: String,
  scanners: Number
});

// Create the reservation model
const Reservation = mongoose.model('Reservation', reservationSchema);

// Define the user schema
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false }
});

// Create the user model
const User = mongoose.model('User', userSchema);

// Serve static files from the "public" directory
app.use(express.static('public'));

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Render the home page
app.get('/', (req, res) => {
  res.render('index');
});

// Render the login form
app.get('/login', (req, res) => {
  res.render('login');
});

// Handle user login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  User.findOne({ email })
    .then(user => {
      if (!user) {
        // User not found
        return res.render('login', { error: 'Invalid email or password' });
      }

      // Compare the provided password with the stored hashed password
      bcrypt.compare(password, user.password, (err, result) => {
        if (result) {
          // Password is correct, set session and redirect to reservation form
          req.session.userId = user._id;
          req.session.isAdmin = user.isAdmin;
          res.redirect('/reservation');
        } else {
          // Password is incorrect
          res.render('login', { error: 'Invalid email or password' });
        }
      });
    })
    .catch(err => {
      console.error('Error logging in:', err);
      res.status(500).send('Internal Server Error');
    });
});

// Handle user logout
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error logging out:', err);
    }
    res.redirect('/');
  });
});

// Render the registration form
app.get('/register', (req, res) => {
  res.render('register');
});

// Serve the index.html file for the root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Handle user registration
app.post('/register', (req, res) => {
  const { email, password } = req.body;

  // Check if the user already exists
  User.findOne({ email })
    .then(existingUser => {
      if (existingUser) {
        // User already exists
        return res.render('register', { error: 'Email is already registered' });
      }

      // Hash the password
      bcrypt.hash(password, 10, (err, hashedPassword) => {
        if (err) {
          console.error('Error hashing password:', err);
          return res.status(500).send('Internal Server Error');
        }

        // Create a new user
        const newUser = new User({
          email,
          password: hashedPassword
        });

        // Save the user to the database
        newUser.save()
          .then(() => {
            // User registration successful, redirect to login page
            res.redirect('/login');
          })
          .catch(err => {
            console.error('Error saving user:', err);
            res.status(500).send('Internal Server Error');
          });
      });
    })
    .catch(err => {
      console.error('Error checking existing user:', err);
      res.status(500).send('Internal Server Error');
    });
});

// Render the reservation form
app.get('/reservation', requireAuth, (req, res) => {
  // Check if the user is an admin
  const isAdmin = req.session.isAdmin || false;

  // Pass the isAdmin flag to your reservation view
  res.render('reservation', { isAdmin });
});

// Handle form submission

app.post('/reserve', requireAuth, (req, res) => {
  const {
    date,
    time,
    department,
    contact,
    location,
    eventStartTime,
    pr5000Time,
    note,
    reentry,
    populationLimit,
    populationDesc,
    scanners
  } = req.body;

  // Here you can handle the boolean conversion for populationLimit
  const isPopulationLimit = populationLimit === 'yes';

  // Create a new reservation with all the fields
  const reservation = new Reservation({
    date,
    time,
    department,
    contact,
    location,
    eventStartTime,
    pr5000Time,
    note,
    reentry,
    populationLimit: isPopulationLimit,
    populationDesc: isPopulationLimit ? populationDesc : '', // Only save if populationLimit is true
    scanners: parseInt(scanners, 10) // Ensure scanners is stored as a number
  });

  // Save the reservation to the database
  reservation.save()
    .then(savedReservation => {
      // Redirect to a success route with the reservation's ID
      res.redirect(`/reservation-success/${savedReservation._id}`);
    })
    .catch(err => {
      console.error('Error saving reservation:', err);
      res.status(500).render('error', { message: 'Error saving reservation.' });
    });
});

// Route for showing reservation success and details
app.get('/reservation-success/:id', requireAuth, (req, res) => {
  const reservationId = req.params.id;

  Reservation.findById(reservationId)
    .then(reservation => {
      if (!reservation) {
        return res.status(404).send('Reservation not found');
      }
      // Render a success template with reservation details
      // Include isAdmin from the session to pass to the EJS template
      res.render('success', { reservation: reservation.toObject(), isAdmin: req.session.isAdmin });
    })
    .catch(err => {
      console.error('Error fetching reservation:', err);
      res.status(500).send('Internal Server Error');
    });
});


// Retrieve reservation data (admin only)
app.get('/reservations', requireAuth, (req, res) => {
  if (req.session.isAdmin) {
    Reservation.find()
      .populate('user', 'email')
      .then(reservations => {
        res.render('reservations', { reservations });
      })
      .catch(err => {
        console.error('Error fetching reservations:', err);
        res.status(500).send('Internal Server Error');
      });
  } else {
    res.status(403).send('Access denied');
  }
});
// Retrieve reservation data for the calendar
// Retrieve reservation data for the calendar
// Retrieve reservation data for the calendar
app.get('/reservations/calendar', requireAuth, (req, res) => {
  Reservation.find()
    .then(reservations => {
      const events = reservations.map(reservation => ({
        start: reservation.date,
        time: reservation.time,
        title: reservation.department
      }));
      res.json(events);
    })
    .catch(err => {
      console.error('Error fetching reservations:', err);
      res.status(500).send('Internal Server Error');
    });
});

// Route for fetching availability data
app.get('/availability', (req, res) => {
  const { startDate, endDate } = req.query;

  Reservation.find({
    startDate: { $lte: endDate },
    endDate: { $gte: startDate }
  })
    .then(reservations => {
      // Calculate the total quantity reserved for each day
      const availability = {};
      // Logic to populate the availability object

      res.json(availability);
    })
    .catch(err => {
      console.error('Error fetching availability:', err);
      res.status(500).send('Internal Server Error');
    });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

