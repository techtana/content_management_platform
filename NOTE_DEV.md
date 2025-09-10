# Developer note for learning
In this work, I'm following tutorial by [Traversy Media](https://www.youtube.com/watch?v=SBvmnHTQIPY&ab_channel=TraversyMedia).

## Step 1: Setting up project
### Create package.json
`npm init`

### Install Dev dependencies
`npm install ...`
* `dotenv` >> handle environment variables in config file
* `luxon` >> date and time manipulation (alternative to moment.js)
* `express` >> web framework
* `express-session` >> managing app sessions and cookies
* `express-handlebars` >> templating engine
* `method-override` >> enable PUT and DELETE HTTP methods
* `morgan` >> logging HTTP requests
* `mongoose` >> work with MongoDB e.g. create model
* `connect-mongo` >> storing MongoDB session data
* `passport` >> authentication
* `passport-google-oauth20` >> google authentication

### Install Dev dependencies
`dependencies` go into the `"dependencies"` section of `package.json`. 
They’re installed in both development and production environments. 
`devDependencies` go into the `"devDependencies"` section. 
They’re skipped when you run:

`npm install --save-dev`  or  `npm install -D`
* `nodemon` >> `node` server that monitors for any changes in your source and automatically restart your server
* `cross-env` >> setting environment variables across platforms (Windows, Linux, macOS) without caring syntax

### Define custom scripts in package.json
The "scripts" section allows you to specify command-line scripts that can be run using `npm run <script-name>`. Note: `npm start` is the same as running `npm run start`. 
```json
"scripts": {
    "start": "cross-env NODE_ENV=production node app.js",
    "dev": "cross-env NODE_ENV=development nodemon app.js"
}
```   

### Creating the skeleton
You can start with creating an `app.js` file. This file will define the app behavior. `app.listen(PORT, ...)` tells Node to create an HTTP server using Express app as the request handler, bind it to the specified port, and begin accepting incoming connections. 


```js title="app.js"
const express = require('express');
const dotenv = require('dotenv');

// load config
dotenv.config({ path: './config/config.env' });
const app = express();
const PORT = process.env.PORT || 5000;

// The app.listen method in Express starts the web server and makes your application listen for incoming HTTP requests on the specified port. 
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});
```

It is typical to also create a `~/config/config.env` file to store app configurations. Together with `dotenv` package which load environment variables in a config file and used within the app (via `process.env.<ENV_VAR_NAME>` ), this is a convenient way to set environment variables as opposed to always setting `env:<ENV_VAR_NAME>=???` in shell everytime you spin up a session.

For an app that connect to database, we need to establish connection to database. To improve readability and maintenance, it is helpful to create a separate js file (i.e. this software concept is called "modularization") that handle just connecting to database. 

```js title="db.py"
const mongoose = require('mongoose');
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

// Export the connectDB function, so it can be used in app.js
module.exports = connectDB;
```

[sub-section](./NOTE_JS.md#javascript-syntax)    