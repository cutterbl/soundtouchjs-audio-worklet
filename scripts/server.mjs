import connect from 'connect';
import path from 'path';
import { fileURLToPath } from 'url';
import serveStatic from 'serve-static';
import open from 'open';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    }),
  )
  .use(serveStatic(path.join(__dirname, '../public')))
  .listen(port, function () {
    console.log(`Go to http://localhost:${port}`);
    open(`http://localhost:${port}`);
  });
