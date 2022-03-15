var os = require('os');

/**
 * Dependancy injection.
 */
module.exports = class DI {

  /**
   * User directory where uploaded photos are saved.
   */
  static dataDirectory() {
    if (os.type() == 'Darwin') {
      return "/Users/esericksanc/Goals/Data";
    } else if (os.type() == 'Linux') {
      return "/home/pi/Pictures";
    } else {
      return "~/tmp";
    }
  }

  /**
   * User directory where metadata is stored.
   */
  static reportsDirectory() {
    if (os.type() == 'Darwin') {
      return "/Users/esericksanc/Goals/Reports";
    } else if (os.type() == 'Linux') {
      return "/home/pi/PiPic";
    } else {
      return "~/tmp";
    }
  }
}
