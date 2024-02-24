# CLIIPC

# Testing locally

In a single terminal:
```
node server.js
```

In another terminal. sk-xxx is your OpenAI key
```
brew install jq
node client.js "$(jq -Rs . example.md)" sk-xxx
```

Edit `example.md` to change.

# Overview

This package is intended to be used to get around Windows session isolation. Windows Session Isolation prevents GUI apps from being spawned by a service.

See these issues:

- https://stackoverflow.com/questions/16366002/bypass-windows-session-isolation-display-warning-message-in-user-session-from-s/16673867#16673867
- https://stackoverflow.com/questions/16366002/bypass-windows-session-isolation-display-warning-message-in-user-session-from-s/16673867#16673867

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
