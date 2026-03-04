const Reading = require('../models/Reading');
const { db } = require('../config/firebase');

class ReadingService {
  async createReading(readingData) {
    try {
      const reading = new Reading(readingData);
      
      const validationErrors = reading.validate();
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '));
      }

      const readingRef = db.collection('lecturas_sensores').doc();
      reading.id = readingRef.id;
      
      const readingDataToSave = {
        id: reading.id,
        email: reading.email,
        fecha: reading.fecha,
        humedadAire: reading.humedadAire,
        humedadSuelo: reading.humedadSuelo,
        temperatura: reading.temperatura
      };
      
      await readingRef.set(readingDataToSave);
      return reading.toJSON();
    } catch (error) {
      console.error('Error creating reading:', error);
      throw new Error('Error creating reading: ' + error.message);
    }
  }

  async findByEmail(email) {
    try {
      if (!email || email.trim().length === 0) {
        throw new Error('Email es requerido');
      }

      const readingsRef = db.collection('lecturas_sensores');
      const snapshot = await readingsRef
        .where('email', '==', email)
        .orderBy('fecha', 'desc')
        .limit(50)
        .get();
      
      if (snapshot.empty) {
        return [];
      }
      
      const readings = [];
      snapshot.forEach(doc => {
        const readingData = doc.data();
        if (!readingData.id) {
          readingData.id = doc.id;
        }
        readings.push(new Reading(readingData));
      });
      
      return readings;
    } catch (error) {
      console.error('Error finding readings by email:', error);
      
      if (error.code === 5 || error.message.includes('NOT_FOUND')) {
        return [];
      }
      
      throw new Error('Error finding readings: ' + error.message);
    }
  }

  async getLatestByEmail(email) {
    try {
      if (!email || email.trim().length === 0) {
        throw new Error('Email es requerido');
      }

      const readingsRef = db.collection('lecturas_sensores');
      const snapshot = await readingsRef
        .where('email', '==', email)
        .orderBy('fecha', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      let readingData;
      snapshot.forEach(doc => {
        readingData = doc.data();
        if (!readingData.id) {
          readingData.id = doc.id;
        }
      });
      
      return new Reading(readingData);
    } catch (error) {
      console.error('Error finding latest reading by email:', error);
      
      if (error.code === 5 || error.message.includes('NOT_FOUND')) {
        return null;
      }
      
      throw new Error('Error finding latest reading: ' + error.message);
    }
  }

  async getStatsByEmail(email) {
    try {
      const readings = await this.findByEmail(email);
      
      if (readings.length === 0) {
        return {
          totalReadings: 0,
          averageHumidity: 0,
          averageTemperature: 0,
          averageSoilHumidity: 0,
          latestStatus: 'Sin datos',
          sensorCount: 0
        };
      }

      const totalReadings = readings.length;
      const totalHumidity = readings.reduce((sum, reading) => sum + reading.humedadAire, 0);
      const totalTemperature = readings.reduce((sum, reading) => sum + reading.temperatura, 0);
      const totalSoilHumidity = readings.reduce((sum, reading) => sum + reading.humedadSuelo, 0);
      
      const latestReading = readings[0];

      return {
        totalReadings,
        averageHumidity: Math.round(totalHumidity / totalReadings),
        averageTemperature: Math.round((totalTemperature / totalReadings) * 10) / 10,
        averageSoilHumidity: Math.round(totalSoilHumidity / totalReadings),
        latestStatus: latestReading.getStatus(),
        latestReading: latestReading.toJSON(),
        sensorCount: readings.length > 0 ? 1 : 0
      };
    } catch (error) {
      console.error('Error calculating stats:', error);
      throw new Error('Error calculating stats: ' + error.message);
    }
  }
}

module.exports = new ReadingService();