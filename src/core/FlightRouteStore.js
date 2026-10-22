import * as Storage from './Storage.js';
import {normalizeTrip} from '../flight/FlightRoute.js';
export const loadTrip=()=>normalizeTrip(Storage.load('flight.trip',null));
export const saveTrip=trip=>Storage.save('flight.trip',normalizeTrip(trip));
