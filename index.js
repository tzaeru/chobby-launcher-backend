const util = require('util');
const exec = util.promisify(require('child_process').exec);
const execSync = require('child_process').execSync;
const fs = require('fs');
const path = require('path');
const extname = path.extname;
const games = require('./games.json');

function getDirectories(path) {
  return fs.readdirSync(path).filter(function (file) {
    return fs.statSync(path+'/'+file).isDirectory();
  });
}

// Check that all the required repos exist.
for(var game in games){
    if (!fs.existsSync("git_clones/" + games[game].repo_name)) {
        const { stdout, stderr } = execSync('sh partial_clone_game.sh ' + games[game].repo_name + ' ' + games[game].repo_url, {cwd: "git_clones"});  
    }
}

// Repo pull function, repeats once a minute, loops over all repos in git_clones/ and updates.
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

async function ls_dist_files() {
  const dirs = getDirectories("git_clones");

  var files_json = {};

  for (var i in dirs)
  {
    const dir = dirs[i];

    // ChobbyLauncher has directory dist for distribution files
    // Games have directory chobbylauncher for chobby launcher config distribution files.
    var dist_dir = "dist/";
    if (dir !== "ChobbyLauncher")
      dist_dir = "chobbylauncher/";

    const { stdout, stderr } = await exec('git ls-files -s ' + dist_dir + "*", {cwd: "git_clones/" + dir});  
    // Split by newline after removing trailing newline
    const stdout_array = stdout.slice(0, stdout.length - 1).split(/\r?\n/);
    
    var dist_files_json = {};
    stdout_array.forEach(function(value)
    {
      var file_json = {};
      // Split by whitespaces or tabulator
      const file_array = value.split(/[ \t]+/);
      // Element 3 is file name, element 1 is checksum as in the git index. Remove dist/ from file name
      file_json["checksum"] = file_array[1];
      file_json["path"] = dir + "/" + file_array[3];
      dist_files_json[file_array[3].replace(dist_dir, "")] = file_json;
    });

    files_json[dir] = dist_files_json;
  }
  
  return files_json;
}

// Web server.
const Koa = require('koa');
const app = module.exports = new Koa();
var Router = require('koa-router');
var router = new Router();

router.get('/files', async (ctx) => {
  ctx.body = await ls_dist_files();
});

router.get('/download', async (ctx) =>
{
  const fpath = path.join("git_clones", ctx.query.path);
  const fstat = await stat(fpath);

  if (fstat.isFile()) {
    ctx.type = extname(fpath);
    ctx.body = fs.createReadStream(fpath);
  }
});

app.use(router.routes());

app.listen(4445);

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
