const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const morgan = require('morgan');
const exphds = require('express-handlebars');
const connectDB = require('./db/db');

// load config
dotenv.config({ path: './config/config.env' });

// connect to database
connectDB();

// create express app
const app = express();

// adding middleware
// NOTE: Middleware are functions that 
// process incoming requests before they reach 
// your route handlers.
if (process.env.NODE_ENV === 'development') {
  // Enables HTTP request logging using the 
  // morgan middleware with the 'dev' format.
  // 
  app.use(morgan('dev'));
}

// Handlebars Template Engine
app.engine('.hbs', exphds.engine({ defaultLayout: 'main', extname: '.hbs' }));
app.set('view engine', '.hbs');

// static folder
app.use(express.static(path.join(__dirname, 'public')));

// define routes
app.use('/', require('./routes/index'));

// start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});