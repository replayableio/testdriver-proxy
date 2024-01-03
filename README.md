# CLIIPC

This package is intended to be used to get around Windows session isolation. Windows Session Isolation prevents GUI apps from being spawned by a service.

# Install Globally

```
npm install cliipc -g
```

## Run server as a user

This is a special command that starts a IPC server. It will execute arbitrary commands via `spawn`. This process should be run as a normal user.

```
cliipc start-server
```

## Run commands as client:

Once the server is running, prepend any cli command with `cliipc` to run it within the user context.

```
cliipc ls
```

Returns to `stdout`:

```
client.js
main.js
node_modules
package-lock.json
package.json
server.js
```
