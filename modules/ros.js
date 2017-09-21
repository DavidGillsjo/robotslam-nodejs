const URL = require('url-parse');
const roslib = require('roslib');
const WiFiScanner = require('./wifi');
const MapSaver = require('./map');
const TrajectorySaver = require('./trajectory');
const MoveBaseClient = require('./move_base_client');

class RosManager {

  constructor() {
    const ros_uri = new URL(process.env['ROS_MASTER_URI']);
    this.ros = new roslib.Ros({
      url: 'ws://' + ros_uri.hostname + ':9090'
    });

    this.connected = false;
    this.reconnectInterval = 5000;
    this.rosbag_topics = ['/scan', '/odom'];

    this.ros.on('connection', () => {
      console.log('Connected to websocket server.');
      this.connected = true;
      this.startCollectionClient = new roslib.Service({
        ros : this.ros,
        name : '/data_collector/start',
        serviceType : 'robotslam_data_collection/Start'
        });
      this.endCollectionClient = new roslib.Service({
        ros : this.ros,
        name : '/data_collector/end',
        serviceType : 'std_srvs/Trigger'
        });
    });

    this.ros.on('error', (error) => {
      console.warn('Error connecting to websocket server:', error.message);
      this.connected = false;
      setTimeout(() => {
        this.ros.connect('ws://' + ros_uri.hostname + ':9090');
      }, this.reconnectInterval);
    });

    this.ros.on('close', () => {
      console.log('Connection to websocket server closed.');
      this.connected = false;
      setTimeout(() => {
        this.ros.connect('ws://' + ros_uri.hostname + ':9090');
      }, this.reconnectInterval);
    });

    this.active = false;
    this.mode = 0;
    this.map = null;
    this.measurementInstance = null;

    this.wifiScanner = new WiFiScanner(this.ros);
  }

  /*
    Start a new exploration for the building.
  */
  async explore(map) {
    if (!this.connected) {
      throw 'Not connected to server';
    }

    if (this.active) {
      throw 'Already active explore';
    }

    var request = new roslib.ServiceRequest({
      name : "exploration",
      topics : this.rosbag_topics,
      store_rosbag : true
      });

    this.startCollectionClient.callService(request, function(result) {
      if (!result.success) {
        throw "Data collection service call failed:" + result.message
      }
    });
    
    this.active = true;
    this.mode = 0;
    this.map = map;
    this.measurementInstance = await this.wifiScanner.start(map);
  }

  /*
    Start a new measurement for the map
   */
  async measurement(map) {
    if (!this.connected) {
      throw 'Not connected to server';
    }

    if (this.active) {
      throw 'Already active explore';
    }

    this.active = true;
    this.mode = 1;
    this.map = map;
    this.measurementInstance = await this.wifiScanner.start(map);
  }

  stop() {
    this.active = false;

    this.wifiScanner.stop();
    if (this.mode === 0) {
      this.moveBaseClient.stop();
      const mapSaver = new MapSaver(this.ros);
      mapSaver.save(this.map);

      // Wait 2s in oder to let the wifi scanner save all data
      setTimeout(() => {
        new TrajectorySaver(this.ros, this.measurementInstance).save();
      }, 2000);
    }
  }

}

module.exports = new RosManager();
