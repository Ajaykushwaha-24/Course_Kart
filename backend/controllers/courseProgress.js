const supabase = require("../config/supabaseClient")


// ================ update Course Progress ================
exports.updateCourseProgress = async (req, res) => {
  const { courseId, subsectionId } = req.body
  const userId = req.user.id

  try {
    // Check if the subsection is valid
    const { data: subsection } = await supabase
      .from('sub_sections').select('id').eq('id', subsectionId).maybeSingle();
    if (!subsection) {
      return res.status(404).json({ error: "Invalid subsection" })
    }

    // Find the course progress document for the user and course
    let { data: courseProgress } = await supabase
      .from('course_progress')
      .select('*')
      .eq('course_id', courseId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!courseProgress) {
      // If course progress doesn't exist, create a new one
      return res.status(404).json({
        success: false,
        message: "Course progress Does Not Exist",
      })
    } else {
      // If course progress exists, check if the subsection is already completed
      if ((courseProgress.completed_videos || []).includes(subsectionId)) {
        return res.status(400).json({ error: "Subsection already completed" })
      }

      // Push the subsection into the completedVideos array
      const updatedCompletedVideos = [...(courseProgress.completed_videos || []), subsectionId];

      // Save the updated course progress
      const { error: updateError } = await supabase
        .from('course_progress')
        .update({ completed_videos: updatedCompletedVideos })
        .eq('id', courseProgress.id);
      if (updateError) throw updateError;
    }

    return res.status(200).json({ message: "Course progress updated" })
  }
  catch (error) {
    console.error(error)
    return res.status(500).json({ error: "Internal server error" })
  }
}
