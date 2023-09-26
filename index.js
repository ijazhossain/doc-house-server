const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.port || 5000;
app.use(cors())
app.use(express.json())

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
        const doctorsCollection = client.db("docHouseDB").collection("doctorsInfo");
        const reviewsCollection = client.db("docHouseDB").collection("reviews");
        const appointmentsCollection = client.db("docHouseDB").collection("appointment");
        const bookingsCollection = client.db("docHouseDB").collection("bookings");
        // appointment related API
        app.get('/patient-appointments', async (req, res) => {
            const patient = req.query.email;
            console.log(patient);
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
            const result = await doctorsCollection.findOne(query);
            res.send(result);
        })
        app.get('/doctors', async (req, res) => {
            const result = await doctorsCollection.find().toArray();
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