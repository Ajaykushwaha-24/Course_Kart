const supabase = require('../config/supabaseClient');
const { categoryToDTO, courseToDTO, userToDTO, ratingToDTO } = require('../utils/transform');

// get Random Integer
function getRandomInt(max) {
    return Math.floor(Math.random() * max)
}

// ================ create Category ================
exports.createCategory = async (req, res) => {
    try {
        // extract data
        const { name, description } = req.body;

        // validation
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const { error } = await supabase.from('categories').insert({ name, description });
        if (error) throw error;

        res.status(200).json({
            success: true,
            message: 'Category created successfully'
        });
    }
    catch (error) {
        console.log('Error while creating Category');
        console.log(error);
        res.status(500).json({
            success: false,
            message: 'Error while creating Category',
            error: error.message
        })
    }
}


// ================ get All Category ================
exports.showAllCategories = async (req, res) => {
    try {
        // get all category from DB
        const { data: allCategories, error } = await supabase
            .from('categories').select('id, name, description');
        if (error) throw error;

        // return response
        res.status(200).json({
            success: true,
            data: allCategories.map(categoryToDTO),
            message: 'All allCategories fetched successfully'
        })
    }
    catch (error) {
        console.log('Error while fetching all allCategories');
        console.log(error);
        res.status(500).json({
            success: false,
            message: 'Error while fetching all allCategories'
        })
    }
}


// Helper: build course DTOs (published only) for a list of course rows,
// with ratingAndReviews populated and optionally instructor populated.
async function buildPublishedCourseDTOs(courseRows, { withInstructor = false } = {}) {
    if (!courseRows || courseRows.length === 0) return [];

    const courseIds = courseRows.map((c) => c.id);

    // ratingAndReviews for these courses
    const { data: ratingRows } = await supabase
        .from('rating_and_reviews')
        .select('*')
        .in('course_id', courseIds);
    const ratingsByCourse = {};
    (ratingRows || []).forEach((r) => {
        if (!ratingsByCourse[r.course_id]) ratingsByCourse[r.course_id] = [];
        ratingsByCourse[r.course_id].push(ratingToDTO(r));
    });

    // enrollments (for studentsEnrolled arrays / counts)
    const { data: enrollmentRows } = await supabase
        .from('enrollments')
        .select('course_id, user_id')
        .in('course_id', courseIds);
    const studentsByCourse = {};
    (enrollmentRows || []).forEach((e) => {
        if (!studentsByCourse[e.course_id]) studentsByCourse[e.course_id] = [];
        studentsByCourse[e.course_id].push(e.user_id);
    });

    // instructors
    let instructorsById = {};
    if (withInstructor) {
        const instructorIds = [...new Set(courseRows.map((c) => c.instructor))];
        const { data: instructorRows } = await supabase
            .from('users').select('*').in('id', instructorIds);
        (instructorRows || []).forEach((u) => {
            instructorsById[u.id] = userToDTO(u);
        });
    }

    return courseRows.map((c) => courseToDTO(c, {
        ratingAndReviews: ratingsByCourse[c.id] || [],
        studentsEnrolled: studentsByCourse[c.id] || [],
        instructor: withInstructor ? (instructorsById[c.instructor] || c.instructor) : undefined,
    }));
}


// ================ Get Category Page Details ================
exports.getCategoryPageDetails = async (req, res) => {
    try {
        const { categoryId } = req.body

        // Get the selected category
        const { data: selectedCategoryRow } = await supabase
            .from('categories').select('*').eq('id', categoryId).maybeSingle();

        // Handle the case when the category is not found
        if (!selectedCategoryRow) {
            return res.status(404).json({ success: false, message: "Category not found" })
        }

        // Published courses for the selected category
        const { data: selectedCourseRows } = await supabase
            .from('courses').select('*').eq('category', categoryId).eq('status', 'Published');

        // Handle the case when there are no courses
        if (!selectedCourseRows || selectedCourseRows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "No courses found for the selected category.",
            })
        }

        const selectedCategoryCourses = await buildPublishedCourseDTOs(selectedCourseRows);
        const selectedCategory = {
            ...categoryToDTO(selectedCategoryRow),
            courses: selectedCategoryCourses,
        };

        // Get courses for other categories
        const { data: categoriesExceptSelected } = await supabase
            .from('categories').select('*').neq('id', categoryId);

        let differentCategory = null;
        if (categoriesExceptSelected && categoriesExceptSelected.length > 0) {
            const randomCategoryRow = categoriesExceptSelected[getRandomInt(categoriesExceptSelected.length)];
            const { data: differentCourseRows } = await supabase
                .from('courses').select('*').eq('category', randomCategoryRow.id).eq('status', 'Published');

            differentCategory = {
                ...categoryToDTO(randomCategoryRow),
                courses: await buildPublishedCourseDTOs(differentCourseRows || []),
            };
        }

        // Get top-selling courses across all categories (published, with instructor populated)
        const { data: allPublishedCourseRows } = await supabase
            .from('courses').select('*').eq('status', 'Published');

        const allCourseDTOs = await buildPublishedCourseDTOs(allPublishedCourseRows || [], { withInstructor: true });

        const mostSellingCourses = allCourseDTOs
            .sort((a, b) => b.studentsEnrolled.length - a.studentsEnrolled.length)
            .slice(0, 10)

        res.status(200).json({
            success: true,
            data: {
                selectedCategory,
                differentCategory,
                mostSellingCourses,
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        })
    }
}
