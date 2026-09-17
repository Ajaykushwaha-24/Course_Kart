const supabase = require('../config/supabaseClient');

const { uploadImageToCloudinary, deleteResourceFromCloudinary } = require('../utils/imageUploader');
const { convertSecondsToDuration } = require('../utils/secToDuration')
const { userToDTO, courseToDTO, sectionToDTO } = require('../utils/transform');




// ================ update Profile ================
exports.updateProfile = async (req, res) => {
    try {
        // extract data
        const { gender = '', dateOfBirth = "", about = "", contactNumber = '', firstName, lastName } = req.body;

        // extract userId
        const userId = req.user.id;


        // find profile
        const { data: userDetails } = await supabase
            .from('users').select('*').eq('id', userId).maybeSingle();
        const profileId = userDetails.additional_details;

        // Update the profile fields
        const { error: userUpdateError } = await supabase
            .from('users')
            .update({ first_name: firstName, last_name: lastName })
            .eq('id', userId);
        if (userUpdateError) throw userUpdateError;

        const { error: profileUpdateError } = await supabase
            .from('profiles')
            .update({
                gender,
                date_of_birth: dateOfBirth,
                about,
                contact_number: contactNumber,
            })
            .eq('id', profileId);
        if (profileUpdateError) throw profileUpdateError;

        const { data: updatedUserRow } = await supabase
            .from('users').select('*').eq('id', userId).maybeSingle();
        const { data: updatedProfileRow } = await supabase
            .from('profiles').select('*').eq('id', profileId).maybeSingle();

        const updatedUserDetails = userToDTO(updatedUserRow, updatedProfileRow);

        // return response
        res.status(200).json({
            success: true,
            updatedUserDetails,
            message: 'Profile updated successfully'
        });
    }
    catch (error) {
        console.log('Error while updating profile');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while updating profile'
        })
    }
}


// ================ delete Account ================
exports.deleteAccount = async (req, res) => {
    try {
        // extract user id
        const userId = req.user.id;

        // validation
        const { data: userDetails } = await supabase
            .from('users').select('*').eq('id', userId).maybeSingle();
        if (!userDetails) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // delete user profile picture From Cloudinary
        await deleteResourceFromCloudinary(userDetails.image);

        // if any student delete their account && enrollded in any course then ,
        // student entrolled in particular course sholud be decreae by one
        // (enrollments table covers both User.courses and Course.studentsEnrolled)
        await supabase.from('enrollments').delete().eq('user_id', userId);

        // first - delete profie (profileDetails)
        if (userDetails.additional_details) {
            await supabase.from('profiles').delete().eq('id', userDetails.additional_details);
        }

        // second - delete account
        await supabase.from('users').delete().eq('id', userId);

        // return response
        res.status(200).json({
            success: true,
            message: 'Account deleted successfully'
        })
    }
    catch (error) {
        console.log('Error while updating profile');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while deleting profile'
        })
    }
}


// ================ get details of user ================
exports.getUserDetails = async (req, res) => {
    try {
        // extract userId
        const userId = req.user.id;

        // get user details
        const { data: userRow, error } = await supabase
            .from('users').select('*').eq('id', userId).maybeSingle();
        if (error) throw error;

        let profileRow = null;
        if (userRow?.additional_details) {
            const { data } = await supabase
                .from('profiles').select('*').eq('id', userRow.additional_details).maybeSingle();
            profileRow = data;
        }

        const userDetails = userToDTO(userRow, profileRow);

        // return response
        res.status(200).json({
            success: true,
            data: userDetails,
            message: 'User data fetched successfully'
        })
    }
    catch (error) {
        console.log('Error while fetching user details');
        console.log(error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while fetching user details'
        })
    }
}



// ================ Update User profile Image ================
exports.updateUserProfileImage = async (req, res) => {
    try {
        const profileImage = req.files?.profileImage;
        const userId = req.user.id;

        // upload imga eto cloudinary
        const image = await uploadImageToCloudinary(profileImage,
            process.env.FOLDER_NAME, 1000, 1000);

        // update in DB
        const { data: updatedUserRow, error: updateError } = await supabase
            .from('users')
            .update({ image: image.secure_url })
            .eq('id', userId)
            .select()
            .single();
        if (updateError) throw updateError;

        let profileRow = null;
        if (updatedUserRow.additional_details) {
            const { data } = await supabase
                .from('profiles').select('*').eq('id', updatedUserRow.additional_details).maybeSingle();
            profileRow = data;
        }

        const updatedUserDetails = userToDTO(updatedUserRow, profileRow);

        // success response
        res.status(200).json({
            success: true,
            message: `Image Updated successfully`,
            data: updatedUserDetails,
        })
    }
    catch (error) {
        console.log('Error while updating user profile image');
        console.log(error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while updating user profile image',
        })
    }
}




// ================ Get Enrolled Courses ================
exports.getEnrolledCourses = async (req, res) => {
    try {
        const userId = req.user.id

        const { data: enrollmentRows } = await supabase
            .from('enrollments').select('course_id').eq('user_id', userId);

        const courseIds = (enrollmentRows || []).map((e) => e.course_id);

        if (courseIds.length === 0) {
            return res.status(200).json({
                success: true,
                data: [],
            })
        }

        const { data: courseRows } = await supabase
            .from('courses').select('*').in('id', courseIds);

        const courses = [];
        for (const courseRow of courseRows) {
            // sections + subsections
            const { data: sectionRows } = await supabase
                .from('sections').select('*').eq('course_id', courseRow.id).order('position', { ascending: true });

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

            let totalDurationInSeconds = 0
            let subsectionLength = 0
            courseContent.forEach((content) => {
                totalDurationInSeconds += content.subSection.reduce((acc, curr) => acc + parseInt(curr.timeDuration), 0)
                subsectionLength += content.subSection.length
            })

            const { data: courseProgressRow } = await supabase
                .from('course_progress')
                .select('completed_videos')
                .eq('course_id', courseRow.id)
                .eq('user_id', userId)
                .maybeSingle();

            const completedCount = courseProgressRow?.completed_videos?.length || 0;

            let progressPercentage;
            if (subsectionLength === 0) {
                progressPercentage = 100
            } else {
                const multiplier = Math.pow(10, 2)
                progressPercentage = Math.round((completedCount / subsectionLength) * 100 * multiplier) / multiplier
            }

            const courseDTO = courseToDTO(courseRow, { courseContent });
            courseDTO.totalDuration = convertSecondsToDuration(totalDurationInSeconds);
            courseDTO.progressPercentage = progressPercentage;

            courses.push(courseDTO);
        }

        return res.status(200).json({
            success: true,
            data: courses,
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}




// ================ instructor Dashboard ================
exports.instructorDashboard = async (req, res) => {
    try {
        const { data: courseRows, error } = await supabase
            .from('courses').select('*').eq('instructor', req.user.id);
        if (error) throw error;

        const courseIds = courseRows.map((c) => c.id);
        const { data: enrollmentRows } = await supabase
            .from('enrollments')
            .select('course_id')
            .in('course_id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']);

        const countByCourse = {};
        (enrollmentRows || []).forEach((e) => {
            countByCourse[e.course_id] = (countByCourse[e.course_id] || 0) + 1;
        });

        const courseData = courseRows.map((course) => {
            const totalStudentsEnrolled = countByCourse[course.id] || 0
            const totalAmountGenerated = totalStudentsEnrolled * course.price

            // Create a new object with the additional fields
            const courseDataWithStats = {
                _id: course.id,
                courseName: course.course_name,
                courseDescription: course.course_description,
                // Include other course properties as needed
                totalStudentsEnrolled,
                totalAmountGenerated,
            }

            return courseDataWithStats
        })

        res.status(200).json(
            {
                courses: courseData,
                message: 'Instructor Dashboard Data fetched successfully'
            },

        )
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Server Error" })
    }
}
