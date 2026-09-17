const supabase = require('./supabaseClient');

exports.connectDB = async () => {
    try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (error) throw error;
        console.log("Supabase Connected Successfully");
    } catch (error) {
        console.log("Supabase Connection Check Failed - check SUPABASE_URL/SUPABASE_SERVICE_KEY and that schema.sql has been run");
        console.error(error.message || error);
    }
};
