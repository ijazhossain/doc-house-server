const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.port || 5000;
app.use(cors())
app.use(express.json())

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    // console.log(authorization);
    if (!authorization) {
        return res.status(401).send({ error: 'true', message: 'unauthorized access 1' });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ error: 'true', message: 'unauthorized access 2' })
        }
        req.decoded = decoded;
        next();
    })
}
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zrkqnje.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const demoServicesCollection = client.db("docHouseDB").collection("demoServices");
        const doctorsInfoCollection = client.db("docHouseDB").collection("doctorsInfo");
        const doctorsCollection = client.db("docHouseDB").collection("doctors");
        const reviewsCollection = client.db("docHouseDB").collection("reviews");
        const appointmentsCollection = client.db("docHouseDB").collection("appointment");
        const bookingsCollection = client.db("docHouseDB").collection("bookings");
        const usersCollection = client.db("docHouseDB").collection("user");
        // user related API
        app.get('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                return res.status(403).send({ error: true, admin: 'false' })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user.role === 'admin' };
            res.send(result);
        })
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, admin: "false" })
            }
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' }
            }
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        app.get('/users', verifyJWT, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const option = { upsert: true };
            const updateDoc = {
                $set: user,
            }
            const result = await usersCollection.updateOne(filter, updateDoc, option);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });
        })
        // appointment related API
        app.get('/patient-appointments', verifyJWT, async (req, res) => {
            const patient = req.query.email;
            // console.log(patient);
            const decodedEmail = req.decoded.email;
            if (patient !== decodedEmail) {
                return res.status(403).send({ error: 'true', message: 'forbidden access' })
            }
            const query = { patient: patient };
            const result = await bookingsCollection.find(query).toArray();
            res.send(result);
        })
        app.get('/available', async (req, res) => {
            const date = req.query.date;
            const query = { date: date };
            const services = await appointmentsCollection.find().toArray();
            const bookings = await bookingsCollection.find(query).toArray();
            services.forEach(service => {
                const bookedServices = bookings.filter(b => b.treatment === service.name);
                // console.log('bookedServices', bookedServices);
                const bookedSlot = bookedServices.map(s => s.slot);
                // console.log('bookedSlot', bookedSlot);
                const available = service.slots.filter(s => !bookedSlot.includes(s));
                service.slots = available;
            })
            res.send(services)
        })
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            // console.log(booking);
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exists = await bookingsCollection.findOne(query);
            // console.log('exists', exists);
            if (exists) {
                return res.send({ success: false, booking: exists })
            }
            const result = await bookingsCollection.insertOne(booking);
            return res.send({ success: true, result });
        })
        app.get('/appointments', async (req, res) => {
            const result = await appointmentsCollection.find({}).toArray();
            res.send(result);
        })
        app.get('/appointment', async (req, res) => {
            const result = await appointmentsCollection.find({}).project({ name: 1 }).toArray();
            res.send(result);
        })
        // reviews related Api
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find({}).toArray();
            res.send(result);
        })
        // doctorInfo related API
        app.get('/doctors/:id', async (req, res) => {
            const id = req.params.id;
            // console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await doctorsInfoCollection.findOne(query);
            res.send(result);
        })
        app.post('/doctor', verifyJWT, async (req, res) => {
            const newDoc = req.body;
            console.log(newDoc);
            const result = await doctorsCollection.insertOne(newDoc);
            res.send(result);
        })
        app.get('/doctors', async (req, res) => {
            const result = await doctorsInfoCollection.find().toArray();
            res.send(result);
        })
        // services API
        app.get('/demoServices/:name', async (req, res) => {
            const name = req.params.name;
            const query = { name: name }
            const result = await demoServicesCollection.findOne(query);
            res.send(result);
        })
        app.get('/demoServices', async (req, res) => {
            const result = await demoServicesCollection.find().toArray();
            res.send(result);
        })
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Doc house server is running')
})
app.listen(port, () => {
    console.log(`Doc house server is running on port ${port}`);
})