const supabase = require('../config/supabaseClient');
const { uploadImageToCloudinary, deleteResourceFromCloudinary } = require('../utils/imageUploader');
const { sectionToDTO } = require('../utils/transform');

// Helper: fetch a section row + its ordered subsections and return the
// same shape the old `.populate('subSection')` produced.
async function getSectionWithSubSections(sectionId) {
    const { data: sectionRow } = await supabase
        .from('sections').select('*').eq('id', sectionId).maybeSingle();
    if (!sectionRow) return null;

    const { data: subSectionRows } = await supabase
        .from('sub_sections').select('*').eq('section_id', sectionId).order('position', { ascending: true });

    return sectionToDTO(sectionRow, subSectionRows || []);
}


// ================ create SubSection ================
exports.createSubSection = async (req, res) => {
    try {
        // extract data
        const { title, description, sectionId } = req.body;

        // extract video file
        const videoFile = req.files.video

        // validation
        if (!title || !description || !videoFile || !sectionId) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            })
        }

        // upload video to cloudinary
        const videoFileDetails = await uploadImageToCloudinary(videoFile, process.env.FOLDER_NAME);

        // find current max position for this section
        const { data: existingSubSections } = await supabase
            .from('sub_sections').select('position').eq('section_id', sectionId).order('position', { ascending: false }).limit(1);
        const nextPosition = existingSubSections && existingSubSections.length > 0 ? existingSubSections[0].position + 1 : 0;

        // create entry in DB, linked to the section
        const { error: createError } = await supabase
            .from('sub_sections')
            .insert({
                title,
                time_duration: videoFileDetails.duration,
                description,
                video_url: videoFileDetails.secure_url,
                section_id: sectionId,
                position: nextPosition,
            });
        if (createError) throw createError;

        const updatedSection = await getSectionWithSubSections(sectionId);

        // return response
        res.status(200).json({
            success: true,
            data: updatedSection,
            message: 'SubSection created successfully'
        });
    }
    catch (error) {
        console.log('Error while creating SubSection');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while creating SubSection'
        })
    }
}



// ================ Update SubSection ================
exports.updateSubSection = async (req, res) => {
    try {
        const { sectionId, subSectionId, title, description } = req.body;

        // validation
        if (!subSectionId) {
            return res.status(400).json({
                success: false,
                message: 'subSection ID is required to update'
            });
        }

        // find in DB
        const { data: subSection } = await supabase
            .from('sub_sections').select('*').eq('id', subSectionId).maybeSingle();

        if (!subSection) {
            return res.status(404).json({
                success: false,
                message: "SubSection not found",
            })
        }

        // add data
        const fieldsToUpdate = {};
        if (title) {
            fieldsToUpdate.title = title;
        }

        if (description) {
            fieldsToUpdate.description = description;
        }

        // upload video to cloudinary
        if (req.files && req.files.video !== undefined) {
            const video = req.files.video;
            const uploadDetails = await uploadImageToCloudinary(video, process.env.FOLDER_NAME);
            fieldsToUpdate.video_url = uploadDetails.secure_url;
            fieldsToUpdate.time_duration = uploadDetails.duration;
        }

        // save data to DB
        if (Object.keys(fieldsToUpdate).length > 0) {
            const { error: updateError } = await supabase
                .from('sub_sections').update(fieldsToUpdate).eq('id', subSectionId);
            if (updateError) throw updateError;
        }

        const updatedSection = await getSectionWithSubSections(sectionId);

        return res.json({
            success: true,
            data: updatedSection,
            message: "Section updated successfully",
        });
    }
    catch (error) {
        console.error('Error while updating the section')
        console.error(error)
        return res.status(500).json({
            success: false,
            error: error.message,
            message: "Error while updating the section",
        })
    }
}



// ================ Delete SubSection ================
exports.deleteSubSection = async (req, res) => {
    try {
        const { subSectionId, sectionId } = req.body

        // fetch subsection first so we have its video URL to delete from Cloudinary
        const { data: subSection } = await supabase
            .from('sub_sections').select('*').eq('id', subSectionId).maybeSingle();

        if (!subSection) {
            return res
                .status(404)
                .json({ success: false, message: "SubSection not found" })
        }

        if (subSection.video_url) {
            await deleteResourceFromCloudinary(subSection.video_url) // delete course video From Cloudinary
        }

        // delete from DB
        const { error: deleteError } = await supabase.from('sub_sections').delete().eq('id', subSectionId);
        if (deleteError) throw deleteError;

        const updatedSection = await getSectionWithSubSections(sectionId);

        // In frontned we have to take care - when subsection is deleted we are sending ,
        // only section data not full course details as we do in others

        // success response
        return res.json({
            success: true,
            data: updatedSection,
            message: "SubSection deleted successfully",
        })
    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,

            error: error.message,
            message: "An error occurred while deleting the SubSection",
        })
    }
}
