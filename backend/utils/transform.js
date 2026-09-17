// Helpers to reshape Supabase (snake_case / `id`) rows back into the same
// shape the old Mongoose documents produced (`_id`, camelCase fields,
// nested "populated" objects) so the frontend needs zero changes.

exports.profileToDTO = (p) => {
    if (!p) return null;
    return {
        _id: p.id,
        gender: p.gender,
        dateOfBirth: p.date_of_birth,
        about: p.about,
        contactNumber: p.contact_number,
    };
};

// pass profileRow if the additionalDetails relation was "populated"
exports.userToDTO = (u, profileRow) => {
    if (!u) return null;
    const dto = {
        _id: u.id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        accountType: u.account_type,
        active: u.active,
        approved: u.approved,
        additionalDetails: profileRow !== undefined
            ? exports.profileToDTO(profileRow)
            : u.additional_details,
        image: u.image,
        token: u.token,
        resetPasswordTokenExpires: u.reset_password_token_expires,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
    };
    return dto;
};

exports.categoryToDTO = (c) => {
    if (!c) return null;
    return {
        _id: c.id,
        name: c.name,
        description: c.description,
    };
};

exports.subSectionToDTO = (s) => {
    if (!s) return null;
    return {
        _id: s.id,
        title: s.title,
        timeDuration: s.time_duration,
        description: s.description,
        videoUrl: s.video_url,
    };
};

// section row + its (already ordered) subsection rows
exports.sectionToDTO = (sec, subSectionRows = []) => {
    if (!sec) return null;
    return {
        _id: sec.id,
        sectionName: sec.section_name,
        subSection: subSectionRows.map(exports.subSectionToDTO),
    };
};

exports.ratingToDTO = (r, userRow, courseRow) => {
    if (!r) return null;
    return {
        _id: r.id,
        rating: r.rating,
        review: r.review,
        user: userRow !== undefined ? exports.userToDTO(userRow) : r.user_id,
        course: courseRow !== undefined ? exports.courseToDTO(courseRow) : r.course_id,
    };
};

// Generic course mapper. Extra populated fields are passed explicitly.
exports.courseToDTO = (c, opts = {}) => {
    if (!c) return null;
    const dto = {
        _id: c.id,
        courseName: c.course_name,
        courseDescription: c.course_description,
        instructor: opts.instructor !== undefined ? opts.instructor : c.instructor,
        whatYouWillLearn: c.what_you_will_learn,
        price: c.price,
        thumbnail: c.thumbnail,
        category: opts.category !== undefined ? opts.category : c.category,
        tag: c.tag || [],
        instructions: c.instructions || [],
        status: c.status,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        studentsEnrolled: opts.studentsEnrolled !== undefined ? opts.studentsEnrolled : [],
        ratingAndReviews: opts.ratingAndReviews !== undefined ? opts.ratingAndReviews : [],
        courseContent: opts.courseContent !== undefined ? opts.courseContent : [],
    };
    return dto;
};
