const express = require('express');
const app = express();

app.use(express.json());

app.post('/', (req, res) => {
    console.log('Received request:', req.body);
    res.json({ status: 'success', received: req.body });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Echo server running on port ${PORT}`);
});
