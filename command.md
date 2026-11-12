delete all submissions

cd /home/uthum/Documents/projects/rotaract/cloudflare-worker
npx wrangler@3 d1 execute rac-attendance --remote --command="DELETE FROM submissions; DELETE FROM sqlite_sequence WHERE name='submissions';"



Verify that it's empty:

npx wrangler@3 d1 execute rac-attendance --remote --command="SELECT COUNT(*) AS total FROM submissions;"
