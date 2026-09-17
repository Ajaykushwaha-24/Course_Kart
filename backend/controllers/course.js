const supabase = require('../config/supabaseClient');

const { uploadImageToCloudinary, deleteResourceFromCloudinary } = require('../utils/imageUploader');
const { convertSecondsToDuration } = require("../utils/secToDuration")
const { courseToDTO, userToDTO, categoryToDTO, profileToDTO, ratingToDTO, sectionToDTO, subSectionToDTO } = require('../utils/transform');


// Helper: fetch ordered sections + subsections for a course and build courseContent array.
// `stripVideoUrl` replicates the original `.select("-videoUrl")` used by the
// public (unauthenticated) getCourseDetails endpoint.
async function buildCourseContent(courseId, { stripVideoUrl = false } = {}) {
    const { data: sectionRows } = await supabase
        .from('sections')
        .select('*')
        .eq('course_id', courseId)
        .order('position', { ascending: true });

    if (!sectionRows || sectionRows.length === 0) return [];

    const sectionIds = sectionRows.map((s) => s.id);
    const { data: subSectionRows } = await supabase
        .from('sub_sections')
        .select('*')
        .in('section_id', sectionIds)
        .order('position', { ascending: true });

    const subsBySection = {};
    (subSectionRows || []).forEach((s) => {
        if (!subsBySection[s.section_id]) subsBySection[s.section_id] = [];
        subsBySection[s.section_id].push(s);
    });

    return sectionRows.map((sec) => {
        const dto = sectionToDTO(sec, subsBySection[sec.id] || []);
        if (stripVideoUrl) {
            dto.subSection = dto.subSection.map((ss) => {
                const { videoUrl, ...rest } = ss;
                return rest;
            });
        }
        return dto;
    });
}

// Helper: fetch instructor (with additionalDetails populated), category, ratingAndReviews,
// and courseContent for a course row, and build the full course DTO.
async function buildFullCourseDTO(courseRow, { stripVideoUrl = false } = {}) {
    // instructor + its profile
    const { data: instructorRow } = await supabase
        .from('users').select('*').eq('id', courseRow.instructor).maybeSingle();
    let profileRow = null;
    if (instructorRow?.additional_details) {
        const { data } = await supabase
            .from('profiles').select('*').eq('id', instructorRow.additional_details).maybeSingle();
        profileRow = data;
    }
    const instructorDTO = instructorRow ? userToDTO(instructorRow, profileRow) : courseRow.instructor;

    // category
    let categoryDTO = courseRow.category;
    if (courseRow.category) {
        const { data: categoryRow } = await supabase
            .from('categories').select('*').eq('id', courseRow.category).maybeSingle();
        categoryDTO = categoryToDTO(categoryRow);
    }

    // ratingAndReviews
    const { data: ratingRows } = await supabase
        .from('rating_and_reviews').select('*').eq('course_id', courseRow.id);
    const ratingAndReviews = (ratingRows || []).map((r) => ratingToDTO(r));

    // courseContent
    const courseContent = await buildCourseContent(courseRow.id, { stripVideoUrl });

    // studentsEnrolled (raw ids)
    const { data: enrollmentRows } = await supabase
        .from('enrollments').select('user_id').eq('course_id', courseRow.id);
    const studentsEnrolled = (enrollmentRows || []).map((e) => e.user_id);

    return courseToDTO(courseRow, {
        instructor: instructorDTO,
        category: categoryDTO,
        ratingAndReviews,
        courseContent,
        studentsEnrolled,
    });
}


// ================ create new course ================
exports.createCourse = async (req, res) => {
    try {
        // extract data
        let { courseName, courseDescription, whatYouWillLearn, price, category, instructions: _instructions, status, tag: _tag } = req.body;

        // Convert the tag and instructions from stringified Array to Array
        const tag = JSON.parse(_tag)
        const instructions = JSON.parse(_instructions)

        // get thumbnail of course
        const thumbnail = req.files?.thumbnailImage;

        // validation
        if (!courseName || !courseDescription || !whatYouWillLearn || !price
            || !category || !thumbnail || !instructions.length || !tag.length) {
            return res.status(400).json({
                success: false,
                message: 'All Fileds are required'
            });
        }

        if (!status || status === undefined) {
            status = "Draft";
        }

        // check current user is instructor or not , bcoz only instructor can create
        // we have insert user id in req.user , (payload , while auth )
        const instructorId = req.user.id;


        // check given category is valid or not
        const { data: categoryDetails } = await supabase
            .from('categories').select('*').eq('id', category).maybeSingle();
        if (!categoryDetails) {
            return res.status(401).json({
                success: false,
                message: 'Category Details not found'
            })
        }


        // upload thumbnail to cloudinary
        const thumbnailDetails = await uploadImageToCloudinary(thumbnail, process.env.FOLDER_NAME);

        // create new course - entry in DB
        const { data: newCourse, error: createError } = await supabase
            .from('courses')
            .insert({
                course_name: courseName,
                course_description: courseDescription,
                instructor: instructorId,
                what_you_will_learn: whatYouWillLearn,
                price,
                category: categoryDetails.id,
                tag,
                status,
                instructions,
                thumbnail: thumbnailDetails.secure_url,
            })
            .select()
            .single();
        if (createError) throw createError;

        // No redundant User.courses / Category.courses arrays to update anymore -
        // enrollments / courses.category FK cover those relationships.

        // return response
        res.status(200).json({
            success: true,
            data: courseToDTO(newCourse),
            message: 'New Course created successfully'
        })
    }

    catch (error) {
        console.log('Error while creating new course');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while creating new course'
        })
    }
}


// ================ show all courses ================
exports.getAllCourses = async (req, res) => {
    try {
        const { data: courseRows, error } = await supabase
            .from('courses').select('*');
        if (error) throw error;

        const instructorIds = [...new Set(courseRows.map((c) => c.instructor))];
        const { data: instructorRows } = await supabase
            .from('users').select('id, first_name, last_name, email, image').in('id', instructorIds);
        const instructorsById = {};
        (instructorRows || []).forEach((u) => {
            instructorsById[u.id] = {
                _id: u.id,
                firstName: u.first_name,
                lastName: u.last_name,
                email: u.email,
                image: u.image,
            };
        });

        const courseIds = courseRows.map((c) => c.id);
        const { data: ratingRows } = await supabase
            .from('rating_and_reviews').select('*').in('course_id', courseIds);
        const ratingsByCourse = {};
        (ratingRows || []).forEach((r) => {
            if (!ratingsByCourse[r.course_id]) ratingsByCourse[r.course_id] = [];
            ratingsByCourse[r.course_id].push(ratingToDTO(r));
        });

        const { data: enrollmentRows } = await supabase
            .from('enrollments').select('course_id, user_id').in('course_id', courseIds);
        const studentsByCourse = {};
        (enrollmentRows || []).forEach((e) => {
            if (!studentsByCourse[e.course_id]) studentsByCourse[e.course_id] = [];
            studentsByCourse[e.course_id].push(e.user_id);
        });

        const allCourses = courseRows.map((c) => courseToDTO(c, {
            instructor: instructorsById[c.instructor] || c.instructor,
            ratingAndReviews: ratingsByCourse[c.id] || [],
            studentsEnrolled: studentsByCourse[c.id] || [],
        }));

        return res.status(200).json({
            success: true,
            data: allCourses,
            message: 'Data for all courses fetched successfully'
        });
    }

    catch (error) {
        console.log('Error while fetching data of all courses');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while fetching data of all courses'
        })
    }
}



// ================ Get Course Details ================
exports.getCourseDetails = async (req, res) => {
    try {
        // get course ID
        const { courseId } = req.body;

        // find course details
        const { data: courseRow } = await supabase
            .from('courses').select('*').eq('id', courseId).maybeSingle();

        //validation
        if (!courseRow) {
            return res.status(400).json({
                success: false,
                message: `Could not find the course with ${courseId}`,
            });
        }

        const courseDetails = await buildFullCourseDTO(courseRow, { stripVideoUrl: true });

        let totalDurationInSeconds = 0
        courseDetails.courseContent.forEach((content) => {
            content.subSection.forEach((subSection) => {
                const timeDurationInSeconds = parseInt(subSection.timeDuration)
                totalDurationInSeconds += timeDurationInSeconds
            })
        })

        const totalDuration = convertSecondsToDuration(totalDurationInSeconds)

        //return response
        return res.status(200).json({
            success: true,
            data: {
                courseDetails,
                totalDuration,
            },
            message: 'Fetched course data successfully'
        })
    }

    catch (error) {
        console.log('Error while fetching course details');
        console.log(error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while fetching course details',
        });
    }
}


// ================ Get Full Course Details ================
exports.getFullCourseDetails = async (req, res) => {
    try {
        const { courseId } = req.body
        const userId = req.user.id

        const { data: courseRow } = await supabase
            .from('courses').select('*').eq('id', courseId).maybeSingle();

        if (!courseRow) {
            return res.status(404).json({
                success: false,
                message: `Could not find course with id: ${courseId}`,
            })
        }

        const courseDetails = await buildFullCourseDTO(courseRow, { stripVideoUrl: false });

        const { data: courseProgressRow } = await supabase
            .from('course_progress')
            .select('*')
            .eq('course_id', courseId)
            .eq('user_id', userId)
            .maybeSingle();

        //   count total time duration of course
        let totalDurationInSeconds = 0
        courseDetails.courseContent.forEach((content) => {
            content.subSection.forEach((subSection) => {
                const timeDurationInSeconds = parseInt(subSection.timeDuration)
                totalDurationInSeconds += timeDurationInSeconds
            })
        })

        const totalDuration = convertSecondsToDuration(totalDurationInSeconds)

        return res.status(200).json({
            success: true,
            data: {
                courseDetails,
                totalDuration,
                completedVideos: courseProgressRow?.completed_videos ? courseProgressRow.completed_videos : [],
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}



// ================ Edit Course Details ================
exports.editCourse = async (req, res) => {
    try {
        const { courseId } = req.body
        const updates = req.body
        const { data: course } = await supabase
            .from('courses').select('*').eq('id', courseId).maybeSingle();

        if (!course) {
            return res.status(404).json({ error: "Course not found" })
        }

        const fieldsToUpdate = {};

        // If Thumbnail Image is found, update it
        if (req.files && req.files.thumbnailImage) {
            const thumbnail = req.files.thumbnailImage
            const thumbnailImage = await uploadImageToCloudinary(
                thumbnail,
                process.env.FOLDER_NAME
            )
            fieldsToUpdate.thumbnail = thumbnailImage.secure_url
        }

        const columnMap = {
            courseName: 'course_name',
            courseDescription: 'course_description',
            whatYouWillLearn: 'what_you_will_learn',
            price: 'price',
            category: 'category',
            status: 'status',
            tag: 'tag',
            instructions: 'instructions',
        };

        // Update only the fields that are present in the request body
        for (const key in updates) {
            if (!updates.hasOwnProperty(key)) continue;
            if (key === "courseId") continue;
            if (key === "tag" || key === "instructions") {
                fieldsToUpdate[columnMap[key]] = JSON.parse(updates[key])
            } else if (columnMap[key]) {
                fieldsToUpdate[columnMap[key]] = updates[key]
            }
        }

        // updatedAt
        fieldsToUpdate.updated_at = new Date().toISOString();

        //   save data
        const { error: updateError } = await supabase
            .from('courses').update(fieldsToUpdate).eq('id', courseId);
        if (updateError) throw updateError;

        const { data: updatedCourseRow } = await supabase
            .from('courses').select('*').eq('id', courseId).maybeSingle();

        const updatedCourse = await buildFullCourseDTO(updatedCourseRow, { stripVideoUrl: false });

        // success response
        res.status(200).json({
            success: true,
            message: "Course updated successfully",
            data: updatedCourse,
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: "Error while updating course",
            error: error.message,
        })
    }
}



// ================ Get a list of Course for a given Instructor ================
exports.getInstructorCourses = async (req, res) => {
    try {
        // Get the instructor ID from the authenticated user or request body
        const instructorId = req.user.id

        // Find all courses belonging to the instructor
        const { data: instructorCourseRows, error } = await supabase
            .from('courses')
            .select('*')
            .eq('instructor', instructorId)
            .order('created_at', { ascending: false });
        if (error) throw error;

        const courseIds = instructorCourseRows.map((c) => c.id);
        const { data: enrollmentRows } = await supabase
            .from('enrollments').select('course_id, user_id').in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']);
        const studentsByCourse = {};
        (enrollmentRows || []).forEach((e) => {
            if (!studentsByCourse[e.course_id]) studentsByCourse[e.course_id] = [];
            studentsByCourse[e.course_id].push(e.user_id);
        });

        const instructorCourses = instructorCourseRows.map((c) => courseToDTO(c, {
            studentsEnrolled: studentsByCourse[c.id] || [],
        }));

        // Return the instructor's courses
        res.status(200).json({
            success: true,
            data: instructorCourses,
            message: 'Courses made by Instructor fetched successfully'
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            message: "Failed to retrieve instructor courses",
            error: error.message,
        })
    }
}



// ================ Delete the Course ================
exports.deleteCourse = async (req, res) => {
    try {
        const { courseId } = req.body

        // Find the course
        const { data: course } = await supabase
            .from('courses').select('*').eq('id', courseId).maybeSingle();
        if (!course) {
            return res.status(404).json({ message: "Course not found" })
        }

        // Unenroll students from the course (single enrollments table covers
        // both the old User.courses and Course.studentsEnrolled arrays)
        await supabase.from('enrollments').delete().eq('course_id', courseId);

        // delete course thumbnail From Cloudinary
        await deleteResourceFromCloudinary(course?.thumbnail);

        // Delete sections and sub-sections (delete Cloudinary videos first,
        // then let the DB cascade-delete the rows when the course is removed)
        const { data: sectionRows } = await supabase
            .from('sections').select('id').eq('course_id', courseId);

        for (const section of (sectionRows || [])) {
            const { data: subSectionRows } = await supabase
                .from('sub_sections').select('*').eq('section_id', section.id);

            for (const subSection of (subSectionRows || [])) {
                if (subSection.video_url) {
                    await deleteResourceFromCloudinary(subSection.video_url) // delete course videos From Cloudinary
                }
            }
        }

        // Delete the course (cascades sections -> sub_sections at the DB level)
        await supabase.from('courses').delete().eq('id', courseId);

        return res.status(200).json({
            success: true,
            message: "Course deleted successfully",
        })

    } catch (error) {
        console.error(error)
        return res.status(500).json({
            success: false,
            message: "Error while Deleting course",
            error: error.message,
        })
    }
}
