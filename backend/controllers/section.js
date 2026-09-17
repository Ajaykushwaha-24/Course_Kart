const supabase = require('../config/supabaseClient');
const { deleteResourceFromCloudinary } = require('../utils/imageUploader');
const { sectionToDTO } = require('../utils/transform');

// Helper: fetch a course with its ordered sections + subsections populated
// (matches the old `.populate({path:'courseContent', populate:{path:'subSection'}})`)
async function getCourseWithContent(courseId) {
    const { data: courseRow } = await supabase
        .from('courses').select('*').eq('id', courseId).maybeSingle();
    if (!courseRow) return null;

    const { data: sectionRows } = await supabase
        .from('sections').select('*').eq('course_id', courseId).order('position', { ascending: true });

    const sectionIds = (sectionRows || []).map((s) => s.id);
    const { data: subSectionRows } = await supabase
        .from('sub_sections')
        .select('*')
        .in('section_id', sectionIds.length ? sectionIds : ['00000000-0000-0000-0000-000000000000'])
        .order('position', { ascending: true });

    const subsBySection = {};
    (subSectionRows || []).forEach((s) => {
        if (!subsBySection[s.section_id]) subsBySection[s.section_id] = [];
        subsBySection[s.section_id].push(s);
    });

    const courseContent = (sectionRows || []).map((sec) => sectionToDTO(sec, subsBySection[sec.id] || []));

    return {
        _id: courseRow.id,
        courseName: courseRow.course_name,
        courseDescription: courseRow.course_description,
        instructor: courseRow.instructor,
        whatYouWillLearn: courseRow.what_you_will_learn,
        price: courseRow.price,
        thumbnail: courseRow.thumbnail,
        category: courseRow.category,
        tag: courseRow.tag || [],
        instructions: courseRow.instructions || [],
        status: courseRow.status,
        createdAt: courseRow.created_at,
        updatedAt: courseRow.updated_at,
        courseContent,
    };
}

// ================ create Section ================
exports.createSection = async (req, res) => {
    try {
        // extract data
        const { sectionName, courseId } = req.body;

        // validation
        if (!sectionName || !courseId) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            })
        }

        // find current max position for this course
        const { data: existingSections } = await supabase
            .from('sections').select('position').eq('course_id', courseId).order('position', { ascending: false }).limit(1);
        const nextPosition = existingSections && existingSections.length > 0 ? existingSections[0].position + 1 : 0;

        // create entry in DB, linked to the course
        const { error: createError } = await supabase
            .from('sections')
            .insert({ section_name: sectionName, course_id: courseId, position: nextPosition });
        if (createError) throw createError;

        const updatedCourseDetails = await getCourseWithContent(courseId);

        res.status(200).json({
            success: true,
            updatedCourseDetails,
            message: 'Section created successfully'
        })
    }

    catch (error) {
        console.log('Error while creating section');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while creating section'
        })
    }
}


// ================ update Section ================
exports.updateSection = async (req, res) => {
    try {
        // extract data
        const { sectionName, sectionId, courseId } = req.body;

        // validation
        if (!sectionId) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // update section name in DB
        const { error: updateError } = await supabase
            .from('sections').update({ section_name: sectionName }).eq('id', sectionId);
        if (updateError) throw updateError;

        const updatedCourseDetails = await getCourseWithContent(courseId);

        res.status(200).json({
            success: true,
            data: updatedCourseDetails,
            message: 'Section updated successfully'
        });
    }
    catch (error) {
        console.log('Error while updating section');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while updating section'
        })
    }
}



// ================ Delete Section ================
exports.deleteSection = async (req, res) => {
    try {
        const { sectionId, courseId } = req.body;

        // delete this section's subsections' Cloudinary videos first, then
        // let the DB cascade-delete the sub_sections rows when the section is removed
        const { data: subSectionRows } = await supabase
            .from('sub_sections').select('video_url').eq('section_id', sectionId);
        for (const subSection of (subSectionRows || [])) {
            if (subSection.video_url) {
                await deleteResourceFromCloudinary(subSection.video_url)
            }
        }

        // delete section by id from DB (DB cascade removes its sub_sections)
        const { error: deleteError } = await supabase.from('sections').delete().eq('id', sectionId);
        if (deleteError) throw deleteError;

        const updatedCourseDetails = await getCourseWithContent(courseId);

        res.status(200).json({
            success: true,
            data: updatedCourseDetails,
            message: 'Section deleted successfully'
        })
    }
    catch (error) {
        console.log('Error while deleting section');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while deleting section'
        })
    }
}
