import React from 'react';
import StationPage from './StationPage';

const KitchenStationPage: React.FC = () => {
  return <StationPage stationName="Food (Kitchen)" station="kitchen" categories={['Savory', 'Bakery']} />;
};

export default KitchenStationPage;
