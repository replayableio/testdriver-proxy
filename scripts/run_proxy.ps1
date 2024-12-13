# Run the Proxy with the user name as the identifier
cd C:\testdriver-proxy
node C:\testdriver-proxy\server.js -i $env:UserName > C:\testdriver-proxy\proxy-$env:UserName.log 2>&1
