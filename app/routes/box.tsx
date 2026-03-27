import { Canvas } from '@react-three/fiber';
import React from 'react';

function Box() {
	return (
		<mesh>
			<boxGeometry args={[1, 1, 1]} />
			<meshStandardMaterial color="orange" />
		</mesh>
	);
}

export default function content() {

	console.log('box加载');
	
	return (
		<div style={{ width: '100vw', height: '100vh' }}>
			<Canvas camera={{ position: [3, 3, 3] }}>
				<ambientLight />
				<pointLight position={[10, 10, 10]} />
				<Box />
			</Canvas>
		</div>
	);
}
