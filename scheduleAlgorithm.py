import firebase_admin
from firebase_admin import credentials, firestore
import numpy as np
import tensorflow as tf
from tensorflow.keras import layers, models, optimizers

# Path to your service account key file
cred = credentials.Certificate('./taksis-a8ba7-firebase-adminsdk-hal48-c54bff4412.json')
firebase_admin.initialize_app(cred)


# Initialize Firestore
db = firestore.client()

# Grabs the reference for the deacon array within the church
def getDeacons(churchName):
    church_ref = db.collection('churches').document(churchName)
    church_doc = church_ref.get()
    church_data = church_doc.to_dict()
    deacons = church_data.get('deacons', [])
    return deacons

# Evaluates the rank prop
def convertRank(rank):
    match rank:
        case "Chanter (Epsaltos)":
            return 1
        case "Reader (Ognostis)":
            return 2
        case "Subdeacon (Epideacon)":
            return 3
        case "Deacon (Full Deacon)":
            return 4
        case _:
            return 0  # Return 0 if rank is not recognized

# Converts the deacons array into a tensor array and adjusts it to 250 elements
def convertToTensor(deacons):
    attributes = []
    for i in deacons:
        age = i['age']
        rank = convertRank(i['rank'])
        experience = i['experience']
        frequency = i['frequency']
        weeks = i['weeksSince']
        attributes.append([age, rank, experience, frequency, weeks])
    
    # Convert to a NumPy array
    np_array = np.array(attributes)

    # Calculate the number of elements needed to make a total of 250
    num_elements = np_array.size
    if num_elements < 250:
        # If there are fewer than 250 elements, pad the array
        pad_size = 250 - num_elements
        np_array = np.pad(np_array, (0, pad_size), 'constant')
    else:
        # If there are more than 250 elements, truncate the array
        np_array = np_array.flatten()[:250]

    # Check the number of rows needed
    desired_rows = 250
    num_rows = np_array.shape

    if num_rows[0] < desired_rows:
        # If there are fewer rows, pad the array
        pad_size = desired_rows - num_rows[0]
        np_array = np.pad(np_array, ((0, pad_size), (0, 0)), mode='constant')
    elif num_rows > desired_rows:
        # If there are more rows, truncate the array
        np_array = np_array[:desired_rows, :]

    # Convert the adjusted NumPy array to a tensor
    tf_tensor = tf.convert_to_tensor(np_array, dtype=tf.float32)
    
    return tf_tensor
#gives a reward based off the results given by the model and results should be a 12 by 5 array 
def rewards(results):
    results_numpy = results.numpy()
    reward = 0
    print(results_numpy.shape)
    # Ensure the input shape is correct (12 arrays with 5 elements each)
    # Ensure there are no empty positions
    for users in results_numpy:
        if np.all(users == 0):
            return -0.2
        # Higher reward for picking people who show up more frequently
        reward += (users[3] - 5) * 0.4
        # Punishes people who serve too often to give others a chance
        if users[4] > 2:
            reward += 0.2 * users[4]
        else:
            reward -= 0.1 * users[4]

    # Ensuring the matins reader is older than 12
    if results_numpy[0, 0] >= 12:
        reward += 0.23
    else:
        reward -= 0.1

    # Reward if matins reader is higher rank
    if results_numpy[0, 1] >= 2:
        reward += 0.2

    # Rewarding if matins reader has experience
    reward += (results_numpy[0, 2] - 5) * 0.15

    # Rewards for picking a younger reader for third and sixth hour
    if 7 <= results_numpy[1, 0] <= 18:
        reward += 0.25
    if 7 <= results_numpy[2, 0] <= 18:
        reward += 0.25

    # Rewards for picking a chanter, punishes anything above subdeacon for third and sixth
    if results_numpy[1, 1] < 2:
        reward += 0.25
    elif results_numpy[1, 1] > 2:
        reward -= 0.3
    if results_numpy[2, 1] < 2:
        reward += 0.25
    elif results_numpy[2, 1] > 2:
        reward -= 0.3

    # Rewards for picking someone over 15 for the reading, punishes heavily for choosing someone under 12
    for i in range(3, 6):
        if results_numpy[i, 0] > 15:
            reward += 0.4
        elif results_numpy[i, 0] <= 12:
            reward -= 0.8

    # Rewards if rank is reader or above for readings
    for i in range(3, 6):
        if results_numpy[i, 1] >= 2:
            reward += 0.15

    # Reward if reader is over 18, punishes if they are younger
    if results_numpy[6, 0] >= 18:
        reward += 0.5
    else:
        reward -= 0.67

    # Punish if reader is below reader rank
    if results_numpy[6, 1] < 2:
        reward -= 0.35

    # Rewards experience
    if results_numpy[6, 2] > 7:
        reward += 0.4

    # Ensures water is older than 16 and punishes 11 or younger
    if results_numpy[7, 0] >= 16:
        reward += 0.27
    elif results_numpy[7, 0] <= 11:
        reward -= 0.33

    # Adds if water holder is reader or above
    if results_numpy[7, 1] >= 2:
        reward += 0.28
    # Experience needed
    if results_numpy[7, 2] > 6.5:
        reward += 0.43
    else:
        reward -= 0.13

    # Wine is more strict about being older
    if results_numpy[8, 0] >= 18:
        reward += 0.42
    elif results_numpy[8, 0] <= 15:
        reward -= 0.33

    # Subdeacon and above gets more benefit
    if results_numpy[8, 1] >= 3:
        reward += 0.4

    # Experience is more valued
    if results_numpy[8, 2] > 7.2:
        reward += 0.6
    elif results_numpy[8, 2] < 4.2:
        reward -= 0.33

    # For alter servers 1 will be relatively older and experienced, another will be a little younger and less experienced
    if results_numpy[9, 0] > 13:
        reward += 0.26
    if results_numpy[9, 1] >= 2:
        reward += 0.17
    if results_numpy[9, 2] > 4.5:
        reward += 0.24

    # Less strict
    if results_numpy[10, 0] > 11:
        reward += 0.21
    if results_numpy[10, 2] > 3.2:
        reward += 0.15

    # Just make sure they're cognizant
    if results_numpy[11, 0] > 8:
        reward += 0.08

    return reward

def generate_custom_tensor(array_size=250):
    num_nonzero = np.random.randint(12, 250 + 1)
    array = np.zeros((array_size, 5))
    for i in range(num_nonzero):
        array[i, 0] = np.random.randint(1, 101)
        array[i, 1] = np.random.randint(1, 5)
        array[i, 2] = np.random.uniform(0, 10)
        array[i, 3] = np.random.uniform(0, 10)
        array[i, 4] = np.random.randint(1, 8)
    tensor = tf.convert_to_tensor(array, dtype=tf.float32)
    return tensor

class PolicyNetwork(tf.keras.Model):
    def __init__(self):
        super(PolicyNetwork, self).__init__()
        layers.InputLayer(input_shape=(1, 250, 5)),  # Example input shape
        layers.Flatten(),
        self.dense1 = layers.Dense(128, activation='relu')
        # Adjust the output size of the final dense layer to match 12 * 5 = 60 units
        self.dense2 = layers.Dense(60, activation='softmax')
    
    def call(self, inputs):
        x = self.dense1(inputs)
        x = self.dense2(x)
        # Reshape the output to (12, 5)
        logits = tf.reshape(x, (12, 5))
        return logits
    

def train(policy_network, optimizer, num_episodes):
    for episode in range(num_episodes):
        with tf.GradientTape() as tape:
            # Generate a random tensor
            state_tensor = generate_custom_tensor()
            state_flat = tf.reshape(state_tensor, [-1])  # Flatten for the policy network
            
            # Get action probabilities
            state_tensor = tf.expand_dims(state_flat, axis=0)  # Add batch dimension
            action_probs = policy_network(state_tensor)
            
            # Sample actions
            action = tf.random.categorical(tf.math.log(action_probs), num_samples=12)
            selected_indices = action.numpy().flatten()
            
            # Get selected arrays
            selected_arrays = state_tensor.numpy()[0][selected_indices]
            
            # Compute reward
            reward = rewards(tf.convert_to_tensor(selected_arrays, dtype=tf.float32))
            
            # Compute loss and update policy
            log_probs = tf.math.log(tf.gather(tf.squeeze(action_probs), selected_indices))
            loss = -tf.reduce_sum(log_probs * reward)
        
        grads = tape.gradient(loss, policy_network.trainable_variables)
        optimizer.apply_gradients(zip(grads, policy_network.trainable_variables))

# Instantiate and train the model
policy_network = PolicyNetwork()
optimizer = tf.keras.optimizers.Adam(learning_rate=0.01)
train(policy_network, optimizer, num_episodes=1000)