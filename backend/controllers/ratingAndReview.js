const supabase = require('../config/supabaseClient')
const { ratingToDTO, userToDTO } = require('../utils/transform');

// ================ Create Rating ================
exports.createRating = async (req, res) => {
    try {
        // get data
        const { rating, review, courseId } = req.body;

        const userId = req.user.id;

        // validation
        if (!rating || !review || !courseId) {
            return res.status(401).json({
                success: false,
                message: "All fileds are required"
            });
        }

        // check user is enrollded in course ?
        const { data: enrollment } = await supabase
            .from('enrollments')
            .select('id')
            .eq('user_id', userId)
            .eq('course_id', courseId)
            .maybeSingle();

        if (!enrollment) {
            return res.status(404).json({
                success: false,
                message: 'Student is not enrolled in the course'
            });
        }


        // check user already reviewd ?
        const { data: alreadyReviewd } = await supabase
            .from('rating_and_reviews')
            .select('id')
            .eq('course_id', courseId)
            .eq('user_id', userId)
            .maybeSingle();

        if (alreadyReviewd) {
            return res.status(403).json({
                success: false,
                message: 'Course is already reviewed by the user'
            });
        }

        // create entry in DB
        const { data: ratingReview, error } = await supabase
            .from('rating_and_reviews')
            .insert({ user_id: userId, course_id: courseId, rating, review })
            .select()
            .single();
        if (error) throw error;

        //return response
        return res.status(200).json({
            success: true,
            data: ratingToDTO(ratingReview),
            message: "Rating and Review created Successfully",
        })
    }
    catch (error) {
        console.log('Error while creating rating and review');
        console.log(error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while creating rating and review',
        })
    }
}




// ================ Get Average Rating ================
exports.getAverageRating = async (req, res) => {
    try {
        //get course ID
        const courseId = req.body.courseId;
        //calculate avg rating

        const { data: ratingRows, error } = await supabase
            .from('rating_and_reviews')
            .select('rating')
            .eq('course_id', courseId);
        if (error) throw error;

        //return rating
        if (ratingRows && ratingRows.length > 0) {
            const averageRating = ratingRows.reduce((acc, curr) => acc + Number(curr.rating), 0) / ratingRows.length;

            return res.status(200).json({
                success: true,
                averageRating,
            })
        }

        //if no rating/Review exist
        return res.status(200).json({
            success: true,
            message: 'Average Rating is 0, no ratings given till now',
            averageRating: 0,
        })
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        })
    }
}





// ================ Get All Rating And Reviews ================
exports.getAllRatingReview = async (req, res) => {
    try {
        const { data: ratingRows, error } = await supabase
            .from('rating_and_reviews')
            .select('*')
            .order('rating', { ascending: false });
        if (error) throw error;

        const userIds = [...new Set(ratingRows.map((r) => r.user_id))];
        const courseIds = [...new Set(ratingRows.map((r) => r.course_id))];

        const { data: userRows } = await supabase
            .from('users').select('id, first_name, last_name, email, image').in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
        const usersById = {};
        (userRows || []).forEach((u) => {
            usersById[u.id] = { _id: u.id, firstName: u.first_name, lastName: u.last_name, email: u.email, image: u.image };
        });

        const { data: courseRows } = await supabase
            .from('courses').select('id, course_name').in('id', courseIds.length ? courseIds : ['00000000-0000-0000-0000-000000000000']);
        const coursesById = {};
        (courseRows || []).forEach((c) => {
            coursesById[c.id] = { _id: c.id, courseName: c.course_name };
        });

        const allReviews = ratingRows.map((r) => ({
            _id: r.id,
            rating: r.rating,
            review: r.review,
            user: usersById[r.user_id] || r.user_id,
            course: coursesById[r.course_id] || r.course_id,
        }));

        return res.status(200).json({
            success: true,
            data: allReviews,
            message: "All reviews fetched successfully"
        });
    }
    catch (error) {
        console.log('Error while fetching all ratings');
        console.log(error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Error while fetching all ratings',
        })
    }
}
