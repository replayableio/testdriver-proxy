node client.js "@testdriverai \r\n\r\n1. open google chrome\r\n2. full screen google chrome\r\n3. navigate to aigrant.com\r\n" sk-xxx

\r\n\r\n1. open google chrome\r\n2. full screen google chrome\r\n3. navigate to aigrant.com\r\n

node client.js "$(jq -Rs . example.md)" sk-xxx

\"\n\n1. Open Google Chrome\n2. Navigate to YouTube.com\n3. Search for Cat Videos\n4. Click the first one\n\"


node client.js "1. open youtube\n\n2.search for cat videos" sk-xxx "rm ~/Desktop/WITH-LOVE-FROM-AMERICA.txt \n npm install dashcam-chrome --save \n /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --start-maximized --load-extension=./node_modules/dashcam-chrome/build/ 1>/dev/null 2>&1 & \n exit"
