const { Client } = require('ssh2');

const HOST = '192.144.162.83';
const USER = 'ubuntu';
const PASS = 'Zhao@198950';
const REMOTE_DIR = '/home/ubuntu/attendance-calendar';

const files = [
  ['index.html', `${REMOTE_DIR}/index.html`],
  ['css/style.css', `${REMOTE_DIR}/css/style.css`],
  ['js/ai-assistant.js', `${REMOTE_DIR}/js/ai-assistant.js`],
  ['js/calendar.js', `${REMOTE_DIR}/js/calendar.js`],
  ['js/holiday-data.js', `${REMOTE_DIR}/js/holiday-data.js`],
  ['server.js', `${REMOTE_DIR}/server.js`],
  ['docker-compose.yml', `${REMOTE_DIR}/docker-compose.yml`],
];

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connected!');
  conn.sftp((err, sftp) => {
    if (err) { console.log('SFTP err:', err.message); conn.end(); return; }
    let done = 0;
    files.forEach(([local, remote]) => {
      sftp.fastPut(local, remote, (err) => {
        done++;
        if (err) console.log(`upload ${local}: ${err.message}`);
        else console.log(`uploaded ${local}`);
        if (done === files.length) {
          sftp.end();
          const cmd = `cd ${REMOTE_DIR} && docker compose up -d --build 2>&1 && sleep 3 && curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:8080`;
          conn.exec(cmd, (err, stream) => {
            if (err) { console.log('exec err:', err.message); conn.end(); return; }
            let out = '';
            stream.on('data', d => out += d.toString());
            stream.stderr.on('data', d => out += d.toString());
            stream.on('close', () => { console.log(out.slice(-500)); conn.end(); });
          });
        }
      });
    });
  });
});
conn.on('error', err => console.log('SSH error:', err.message));
conn.connect({ host: HOST, port: 22, username: USER, password: PASS, readyTimeout: 30000 });
