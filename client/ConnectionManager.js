class ConnectionManager {
    constructor(tetrisManager) {
        this.conn = null;
        this.peers = new Map;

        this.tetrisManager = tetrisManager;
        this.localTetris = [...tetrisManager.instances][0];
    }

    connect(address) {
        this.conn = new WebSocket(address);

        this.conn.addEventListener('open', () => {
            console.log('Connection established');
            this.initSession();
            this.watchEvents();
        });

        this.conn.addEventListener('message', event => {
            console.log('Recevied message', event.data);
            this.receive(event.data);
        });
    } 

    watchEvents(){
        const local = this.localTetris;
        const player = local.player;
        ['pos', 'matrix', 'score'].forEach(prop =>{
            player.events.listen(prop, value => {
                this.send({
                    type: 'state-update',
                    fragment: 'player',
                    state: [prop, value],
                });
            });
        });

        const arena = local.arena;
        ['matrix'].forEach(prop =>{
            arena.events.listen(prop, value => {
                this.send({
                    type: 'state-update',
                    fragment: 'arena',
                    state: [prop, value],
                });
            });
        });
    }

    initSession() {
        const sessionId = window.location.hash.split('#')[1];
        if (sessionId) {
            this.send({
                type: 'join-session',
                id: sessionId,
            });
        } else {
            this.send({
                type: 'create-session',
            });
        }
    }

    updateManager(peers) {
        const me = peers.you;
        const clients = peers.clients.filter(id => me !== id);
        clients.forEach(id => {
            if (!this.peers.has(id)) {
                const tetris = this.tetrisManager.createPlayer();
                this.peers.set(id, tetris);
            }
        });

        [...this.peers.entries()].forEach(([id, tetris]) => {
            if (clients.indexOf(id) === -1) {
                this.tetrisManager.removePlayer(tetris);
                this.peers.delete(id);
            }
        })
    }

    updatePeer(id, fragment, [prop, value]){
        if(!this.peers.has(id)){
            console.error('Client does not exits', id);
            return;
        }

        const tetris = this.peers.get(id);
        tetris[fragment][prop] = value;

        if(prop === 'score'){
            tetris.updateScore(value);
        } else {
            tetris.draw();
        }
    }

    receive(msg) {
        const data = JSON.parse(msg);
        if (data.type === 'session-created') {
            window.location.hash = data.id;
        } else if (data.type === 'session-broadcast') {
            this.updateManager(data.peers);
        } else if(data.type === 'state-update') {
            this.updatePeer(data.clientId, data.fragment, data.state);
        }
    }

    send(data) {
        const msg = JSON.stringify(data);
        console.log(`Sending message ${msg}`);
        this.conn.send(msg);
    }
}