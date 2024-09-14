const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const firebaseAdmin = require('firebase-admin');
const path = require('path');
const { check, validationResult } = require('express-validator');

// Initialize Express app
const app = express();
const port = 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
});
const db = firebaseAdmin.firestore();

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
    secret: 'your-session-secret', // Replace with your session secret
    resave: false,
    saveUninitialized: true,
}));
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (like CSS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/signup', (req, res) => {
    res.render('signup', { error: null });
});

app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userRef = db.collection('users').doc(email);
        const doc = await userRef.get();

        if (doc.exists) {
            res.render('signup', { error: 'User already exists.' });
        } else {
            const hashedPassword = await bcrypt.hash(password, 10);
            await userRef.set({ email, password: hashedPassword });
            res.redirect('/login');
        }
    } catch (err) {
        console.error(err);
        res.render('signup', { error: 'Something went wrong. Please try again.' });
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const userRef = db.collection('users').doc(email);
        const doc = await userRef.get();

        if (doc.exists) {
            const user = doc.data();
            const match = await bcrypt.compare(password, user.password);

            if (match) {
                req.session.user = { email };
                res.redirect('/search');
            } else {
                res.render('login', { error: 'Invalid credentials.' });
            }
        } else {
            res.render('login', { error: 'User does not exist.' });
        }
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'Something went wrong. Please try again.' });
    }
});

app.get('/search', (req, res) => {
    if (req.session.user) {
        res.render('search', { recipes: null, error: null });
    } else {
        res.redirect('/login');
    }
});

app.post('/search', async (req, res) => {
    const { ingredient } = req.body;

    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${ingredient}`);
        const data = await response.json();

        if (data.meals) {
            res.render('search', { recipes: data.meals, error: null });
        } else {
            res.render('search', { recipes: null, error: 'No recipes found.' });
        }
    } catch (err) {
        console.error(err);
        res.render('search', { recipes: null, error: 'Something went wrong. Please try again.' });
    }
});

app.get('/recipe/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`);
        const data = await response.json();

        if (data.meals && data.meals.length > 0) {
            res.render('recipe', { recipe: data.meals[0], error: null });
        } else {
            res.render('recipe', { recipe: null, error: 'Recipe not found.' });
        }
    } catch (err) {
        console.error(err);
        res.render('recipe', { recipe: null, error: 'Something went wrong. Please try again.' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
