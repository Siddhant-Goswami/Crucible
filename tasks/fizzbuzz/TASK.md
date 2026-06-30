# Task: implement FizzBuzz correctly

`fizzbuzz.js` exports `fizzbuzz(n)` but ships **broken on purpose**: it never
returns `"FizzBuzz"` for numbers divisible by both 3 and 5.

Required behavior:

- divisible by 3 **and** 5 → `"FizzBuzz"`
- divisible by 3 only → `"Fizz"`
- divisible by 5 only → `"Buzz"`
- otherwise → the number as a string (e.g. `fizzbuzz(7) === "7"`)

Edit `fizzbuzz.js` so `node --test` passes. Do not edit the test file.
