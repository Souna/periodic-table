// Hide the console window on Windows release builds; otherwise a terminal
// would pop up behind the app every launch.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    periodic_table_lib::run()
}
