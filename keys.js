const fs = require('fs');
const NodeRSA = require('node-rsa');

const generateAndSaveKeys = () => {
    const key = new NodeRSA({ b: 512 });
    const publicKey = key.exportKey('public');
    const privateKey = key.exportKey('private');

    fs.writeFileSync('./public.key', publicKey);
    fs.writeFileSync('./private.key', privateKey);
};

const loadKeys = () => {
    const publicKey = fs.readFileSync('./public.key', 'utf8');
    const privateKey = fs.readFileSync('./private.key', 'utf8');

    return { publicKey, privateKey };
};

module.exports = {
    generateAndSaveKeys,
    loadKeys,
};
