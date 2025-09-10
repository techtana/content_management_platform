## JavaScript Syntax
> [!NOTE] 
> In the scripts above, you can see `const mongoose = require('mongoose');`. This means, you are assigning the result of `require('mongoose')` to the variable `mongoose`. 
> 
> Similarly, `const connectDB = async () => {...}` assigns an **anonymous async function** to the variable `connectDB`. To unpack a little, `() => {...}` is known as an "arrow function", which is an alternative syntax to define a function. An "anonymous" function is a function without a name. They are useful for callbacks, event handlers, or when you don’t need to reuse the function by name elsewhere in your code. `async` is a keyword to perform a non-blocking operation without stopping the rest of your program from running. Finally, `export` is a way to make variables, functions, or objects available for use in other files. By exporting something, you allow other files to import and use it, enabling code modularity and reuse.

## Function declaration
> [!NOTE] 
> Traditionally in Javascript, `function` keyword is used to define a function or a constructor. See the example below.  
> ```js 
> // as a regular function ~ think of `def` in python
> function greet(name) {
>   console.log("Hello, " + name);
> }
> greet("Lisa"); // Output: Hello Lisa
> ```
>
> ```js
> // as a constructor ~ think of `class` in python
> function Car(model) {
>   this.model = model;
> }
> const myCar = new Car("Toyota");
> console.log(myCar.model); // Output: Toyota
> ```
> Arrow function seen previously (i.e. `() => {...}`) is a concise way to define functions in JavaScript. You can think of it as a equivalent of python's lambda function, but arrow function allows more elaborate expressions such as try-except. Arrow functions are often used for shorter, inline functions.
> 
> While not suitable for a complex function or constructor, for a simple use case like `connectDB` or `greet()`, this function does not need its own `this.<method_name>` context, does not use arguments and is not intended to be used as a constructor. Therefore, using an arrow function or a regular function works as well. 
> The choice between the two is mostly a matter of style and simplicity. Arrow functions provide a concise syntax and make it clear that connectDB is just a utility function. For standalone functions like this — especially those exported as modules — using an arrow function is common and helps keep the code modern and readable. 


## Function hoisting
> [!Warning] 
> One interesting feature of a traditional function declaration (using function keyword) is that it allows what is called "function hoisting". Basically, this means instead of first writing the function definition earlier in the `.js` file (e.g. line# 32) before calling it (e.g. line# 58), you can call the function name earlier in the file (e.g. line# 22), before the function definition. 
> 
> ```js
> const myCar = new Car("Toyota");
> ... // some core codes
> 
> // declare later
> function Car(model) {
>  this.model = model;
> }
> ```
>
> Function hoisting can lead to confusion if overused or if code is not well-organized, since it allows functions to be called before they are defined. This flexibility can sometimes hide mistakes, such as typos in function names or unintended function calls, making bugs harder to spot.
> 
> However, when used thoughtfully, hoisting can improve code readability by letting you place high-level logic at the top and helper functions below. Good design and clear structure are still important—hoisting is just a tool that, like any feature, should be used with care to avoid messy or hard-to-follow code. Many developers prefer to define functions before they are used, or use function expressions/arrow functions, to make dependencies explicit and code easier to follow.


## Async and Promise
> [!NOTE]
> In JavaScript, async (short for asynchronous) allows you to write functions that perform non-blocking operations, such as reading files, making network requests, or querying a database, without stopping the rest of your program from running.
> When you declare a function as async, it always returns a Promise. Inside an async function, you can use the await keyword to pause execution until a Promise is resolved or rejected. This makes asynchronous code look and behave more like regular, synchronous code, making it easier to read and maintain.
> For example:
> ```js
> async function fetchData() {
>  const response = await fetch('https://api.example.com/data');
>  const data = await response.json();
>  return data;
> }
> ```
> Here, `fetchData` waits for the fetch and `response.json()` calls to complete, but the rest of your program can keep running in the meantime. This is useful for handling tasks that take time, like network or database operations, without freezing your application.
> If you call an async function like fetchData() outside of an async context, it returns a Promise, not the actual data. This means you can’t use the result directly as a normal value—you must handle the Promise.
> For example:
> ```js
> const result = fetchData();
> console.log(result); // This logs: Promise { <pending> }
> ```
> 
> To get the actual data, you must use `.then()` or `await` (inside another async function):
> Using `.then()`:
> ```js
> fetchData().then(data => {
>   console.log(data); // Now you have the real data
> });
> ```
> Or with `await` inside another async function:
> ```js
> async function main() {
>  const data = await fetchData();
>  console.log(data);
> }
> main();
> ```
> If you try to use the data directly outside of these patterns, you'll only get a Promise, not the resolved value.

