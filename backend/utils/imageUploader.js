const cloudinary = require('cloudinary').v2;

exports.uploadImageToCloudinary = async (file, folder, height, quality) => {
    if (!process.env.CLOUD_NAME || !process.env.API_KEY || !process.env.API_SECRET) {
        console.log('Cloudinary not configured - skipping real upload, using placeholder URL');
        return {
            secure_url: 'https://via.placeholder.com/640x360?text=Upload+not+configured',
            duration: 0,
        };
    }

    try {
        const options = { folder };
        if (height) options.height = height;
        if (quality) options.quality = quality;

        // options.resourse_type = 'auto';
        options.resource_type = 'auto';
        return await cloudinary.uploader.upload(file.tempFilePath, options);
    }
    catch (error) {
        console.log("Error while uploading image");
        console.log(error);
        throw error;
    }
}



// Function to delete a resource by public ID
exports.deleteResourceFromCloudinary = async (url) => {
    if (!url) return;
    if (!process.env.CLOUD_NAME || !process.env.API_KEY || !process.env.API_SECRET) {
        console.log('Cloudinary not configured - skipping delete for', url);
        return;
    }

    try {
        const result = await cloudinary.uploader.destroy(url);
        console.log(`Deleted resource with public ID: ${url}`);
        console.log('Delete Resourse result = ', result)
        return result;
    } catch (error) {
        console.error(`Error deleting resource with public ID ${url}:`, error);
        throw error;
    }
};