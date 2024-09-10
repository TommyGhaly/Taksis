import firebase_admin
from firebase_admin import credentials, firestore
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

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
    tf_tensor = torch.convert_to_tensor(np_array, dtype=torch.float32)
    
    return tf_tensor

    tensor = torch.tensor(np_array, dtype=torch.float32)

    return tensor
#gives a reward based off the results given by the model and results should be a 12 by 5 array 
# Reward Function

def rewards(results):
    # Ensure results is a PyTorch tensor
    results = torch.tensor(results, dtype=torch.float32)
    
    # Check for NaNs or Infs
    if torch.isnan(results).any() or torch.isinf(results).any():
        raise ValueError("Results contain NaNs or Infs")
    
    reward = 0

    # Ensure results are within a valid range
    results = torch.clamp(results, min=-1e6, max=1e6)
    
    # Iterate through each user in results
    for i in range(results.shape[0]):
        users = results[i]
        
        # Check for empty users
        if torch.all(users == 0):
            return torch.tensor(-0.2, dtype=torch.float32)

        # Higher reward for picking people who show up more frequently
        reward += (users[3] - 5) * 0.4

        # Handle the condition for users[4] with element-wise operations
        if users[4] > 2:
            reward += 0.2 * users[4]
        else:
            reward -= 0.1 * users[4]

    # Ensures the matins reader is older than 12
    if results[0, 0] >= 12:
        reward += 0.23
    else:
        reward -= 0.1

    # Reward if matins reader is higher rank
    if results[0, 1] >= 2:
        reward += 0.2

    # Rewarding if matins reader has experience
    reward += (results[0, 2] - 5) * 0.15

    # Rewards for picking a younger reader for third and sixth hour
    if 7 <= results[1, 0] <= 18:
        reward += 0.25
    if 7 <= results[2, 0] <= 18:
        reward += 0.25

    # Rewards for picking a chanter, punishes anything above subdeacon for third and sixth
    if results[1, 1] < 2:
        reward += 0.25
    elif results[1, 1] > 2:
        reward -= 0.3
    if results[2, 1] < 2:
        reward += 0.25
    elif results[2, 1] > 2:
        reward -= 0.3

    # Rewards for picking someone over 15 for the reading, punishes heavily for choosing someone under 12
    for i in range(3, 6):
        if results[i, 0] > 15:
            reward += 0.4
        elif results[i, 0] <= 12:
            reward -= 0.8

    # Rewards if rank is reader or above for readings
    for i in range(3, 6):
        if results[i, 1] >= 2:
            reward += 0.15

    # Reward if reader is over 18, punishes if they are younger
    if results[6, 0] >= 18:
        reward += 0.5
    else:
        reward -= 0.67

    # Punish if reader is below reader rank
    if results[6, 1] < 2:
        reward -= 0.35

    # Rewards experience
    if results[6, 2] > 7:
        reward += 0.4

    # Ensures water is older than 16 and punishes 11 or younger
    if results[7, 0] >= 16:
        reward += 0.27
    elif results[7, 0] <= 11:
        reward -= 0.33

    # Adds if water holder is reader or above
    if results[7, 1] >= 2:
        reward += 0.28

    # Experience needed
    if results[7, 2] > 6.5:
        reward += 0.43
    else:
        reward -= 0.13

    # Wine is more strict about being older
    if results[8, 0] >= 18:
        reward += 0.42
    elif results[8, 0] <= 15:
        reward -= 0.33

    # Subdeacon and above gets more benefit
    if results[8, 1] >= 3:
        reward += 0.4

    # Experience is more valued
    if results[8, 2] > 7.2:
        reward += 0.6
    elif results[8, 2] < 4.2:
        reward -= 0.33

    # For alter servers 1 will be relatively older and experienced, another will be a little younger and less experienced
    if results[9, 0] > 13:
        reward += 0.26
    if results[9, 1] >= 2:
        reward += 0.17
    if results[9, 2] > 4.5:
        reward += 0.24

    # Less strict
    if results[10, 0] > 11:
        reward += 0.21
    if results[10, 2] > 3.2:
        reward += 0.15

    # Just make sure they're cognizant
    if results[11, 0] > 8:
        reward += 0.08

    return torch.tensor(reward, dtype=torch.float32)

def generate_custom_tensor(array_size=250):
    """
    Generate a custom tensor with specified constraints.

    :param array_size: Number of rows in the array (default is 250).
    :return: A PyTorch tensor with the generated values.
    """
    # Number of non-zero rows
    num_nonzero = np.random.randint(12, array_size + 1)
    
    # Initialize array with zeros
    array = np.zeros((array_size, 5), dtype=np.float32)
    
    # Generate non-zero rows
    for i in range(num_nonzero):
        array[i, 0] = np.random.randint(1, 101)      # Integer between 1 and 100
        array[i, 1] = np.random.randint(1, 5)        # Integer between 1 and 4
        array[i, 2] = np.random.uniform(0, 10)       # Float between 0 and 10
        array[i, 3] = np.random.uniform(0, 10)       # Float between 0 and 10
        array[i, 4] = np.random.randint(1, 8)        # Integer between 1 and 7
    
    # Convert to PyTorch tensor
    tensor = torch.tensor(array, dtype=torch.float32)
    
    # Check for NaNs and Infs
    if torch.isnan(tensor).any():
        raise ValueError("Tensor contains NaNs.")
    if torch.isinf(tensor).any():
        raise ValueError("Tensor contains Infs.")
    
    return tensor

class CustomModel(nn.Module):
    def __init__(self, input_shape=250, num_outputs=12):
        super(CustomModel, self).__init__()
        self.fc1 = nn.Linear(input_shape * 5, 256)
        self.fc2 = nn.Linear(256, 128)
        self.fc3 = nn.Linear(128, input_shape)
    
    def forward(self, x):
        x = x.view(x.size(0), -1)  # Flatten the input
        x = torch.relu(self.fc1(x))
        x = torch.relu(self.fc2(x))
        x = self.fc3(x)
        return x


def select_top_12_indices(logits):
    # Select the top 12 indices based on logits
    _, top_12_indices = torch.topk(logits, 12, dim=1, largest=True, sorted=False)
    return top_12_indices


def compute_loss(model, input_array):
    logits = model(input_array)
    top_12_indices = select_top_12_indices(logits)
    top_12_arrays = torch.gather(input_array, 0, top_12_indices.unsqueeze(-1).expand(-1, -1, input_array.size(2)))
    reward = rewards(top_12_arrays)
    loss = -reward.sum()
    return loss

def train_model(model, optimizer, num_episodes=1000):
    for episode in range(num_episodes):
        input_array = generate_custom_tensor()  # Shape: (250, 5)
        input_array = torch.tensor(input_array, dtype=torch.float32)
        
        optimizer.zero_grad()
        loss = compute_loss(model, input_array)
        loss.backward()
        optimizer.step()
        
        print(f"Episode: {episode + 1}, Loss: {loss.item()}")

# Initialize the model and optimizer
model = CustomModel()
optimizer = optim.Adam(model.parameters(), lr=0.001)

train_model(model, optimizer, num_episodes=1000)