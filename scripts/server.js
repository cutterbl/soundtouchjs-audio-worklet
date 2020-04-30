const connect = require('connect');
const path = require('path');
const serveStatic = require('serve-static');

const port = 8081;

const setHeaders = (res) => {
  res.setHeader('Content-Type', 'application/javascript');
};

connect()
  .use(
    '/js',
    serveStatic(path.join(__dirname, '../dist'), {
      index: false,
      setHeaders: setHeaders,
    })
  )
  .use(serveStatic(path.join(__dirname, '../public')))
  .listen(8081, function () {
    console.log(`Go to http://localhost:${port}`);
  });
