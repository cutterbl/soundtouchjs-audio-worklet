const connect = require('connect');
const path = require('path');
const serveStatic = require('serve-static');
const open = require('open');

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
  .listen(port, function () {
    console.log(`Go to http://localhost:${port}`);
    open(`http://localhost:${port}`);
  });
