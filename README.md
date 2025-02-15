# treehacks25

## Zoom mock server instructions
Documentation here: https://github.com/ojusave/mockRTMSserver
### Setup
1) Install Docker
2) Clone repo (link)
3) Build container (see intstruction at link)

### Mock Server
1) Run container
2) Open address (server): http://localhost:9092 

### Client
1) Run 'mockRTMSserver/node test_client/server.js'
2) Run 'ngrok http 8000'
3) Copy address URL into the Server at http://localhost:9092 (should receive confirmation on client)
4) Start recording on the server and receive datastream on the client



### TODO
Modify (a copy of) test_client/server.js
In lines 181-207 there is the function executed any time a new message is received from the Zoom mock server. This stream can be forwarded to another websocket (atm at the address "http://localhost:5000/process_media"), that can be read by the LangChain Server (not sure how that part works).
