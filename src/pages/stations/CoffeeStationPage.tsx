import React from 'react';
import StationPage from './StationPage';

const CoffeeStationPage: React.FC = () => {
  return <StationPage stationName="Drinks (Coffee)" station="coffee" categories={['Filter Coffee', 'Mocktail']} />;
};

export default CoffeeStationPage;
