const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const path = require('path');
const extname = path.extname;

function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}

// Repo pull function, repeats once a minute
async function pull_repos() {
  const clone_dirs = getDirectories('git_clones');
  for (var i in clone_dirs)
  {
    const { stdout, stderr } = await exec('git pull', {cwd: "git_clones/" + clone_dirs[i]});
  }
  
  const minutes = 1, pull_interval = minutes * 60 * 1000;
  setTimeout(pull_repos, pull_interval);
}
pull_repos();

async function ls() {
  const { stdout, stderr } = await exec('git ls-files -s dist/*', {cwd: "git_clones/ChobbyLauncher"});  
  // Split by newline after removing trailing newline
  const stdout_array = stdout.slice(0, stdout.length - 1).split(/\r?\n/);
    
  var file_json = {};
  stdout_array.forEach(function(value)
  {
    // Split by whitespaces or tabulator
    const file_array = value.split(/[ \t]+/);
    // Element 2 is file name, element 1 is checksum as in the git index. Remove dist/ from file name
    file_json[file_array[3].replace("dist/", "")] = file_array[1];
  });
  
  return file_json;
}
ls();

// Web server.
const Koa = require('koa');
const app = module.exports = new Koa();
var Router = require('koa-router');
var router = new Router();

router.get('/launcher', async (ctx) => {
  ctx.body = await ls();
});

router.get('/download/:file', async (ctx) =>
{
  const fpath = path.join("git_clones/ChobbyLauncher/dist", ctx.params.file);
  const fstat = await stat(fpath);
      
  if (fstat.isFile()) {
    ctx.type = extname(fpath);
    ctx.body = fs.createReadStream(fpath);
  }
});

app.use(router.routes());

app.listen(4444);

/**
 * thunkify stat. Straight outta koa examples lul.
*/
function stat(file) {
  return new Promise(function(resolve, reject) {
    fs.stat(file, function(err, stat) {
      if (err) {
        reject(err);
      } else {
        resolve(stat);
      }
    });
  });
}
