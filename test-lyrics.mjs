const res = await fetch("http://localhost:3000/api/lyrics?track=Rolling+in+the+Deep&artist=Adele");
const data = await res.json();
console.log(JSON.stringify(data, null, 2));
