const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: 'dprzpjxyc',
    api_key: '588963441415759',
    api_secret: '5EueYIDMHMBXtYgs5KyLL2uNwAQ'
});

module.exports = cloudinary;
