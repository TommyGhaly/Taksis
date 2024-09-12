import firebase_admin
from firebase_admin import credentials, firestore
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.nn.functional as F
import matplotlib.pyplot as plt


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


class CustomModel(nn.Module):
    def __init__(self):
        super(CustomModel, self).__init__()
        # Transforming 250 * 5 features into higher dimensionality
        self.fc1 = nn.Linear(250 * 5, 1024)  # From 1250 units to 1024 units
        self.fc2 = nn.Linear(1024, 512)  # From 1024 units to 512 units
        self.fc3 = nn.Linear(512, 250)  # Output a single array of size 250

    def forward(self, x):
        # x has shape (250, 5)
        x = x.view(1, -1)  # Flatten to shape (1, 1250)
        x = torch.relu(self.fc1(x))  # Apply ReLU activation
        x = torch.relu(self.fc2(x))  # Apply ReLU activation
        x = self.fc3(x)  # Output raw scores: shape (1, 250)
        x = F.softmax(x, dim=1)  # Apply softmax to get probabilities
        return x
    
def rewards(results):
    results = results[0]
    results = torch.tensor(results, dtype=torch.float32)
    # Check for NaNs or Infs
    if torch.isnan(results).any() or torch.isinf(results).any():
        raise ValueError("Results contain NaNs or Infs")

    reward = 0
    results = torch.clamp(results, min=-1e6, max=1e6)

    # Calculate reward based on results
    for i in range(results.shape[0]):
        users = results[i]
        if torch.all(users == 0):
            return torch.tensor(-5, dtype=torch.float32)

        reward += (users[3] - 5) * 0.4

        if (users[4] > 2).any():
            reward += 0.2 * users[4].sum()
        else:
            reward -= 0.1 * users[4].sum()

    if results[0, 0] >= 12:
        reward += 0.23
    else:
        reward -= 0.1

    if results[0, 1] >= 2:
        reward += 0.2

    reward += (results[0, 2] - 5) * 0.15

    if (7 <= results[1, 0] <= 18).all():
        reward += 0.25
    if (7 <= results[2, 0] <= 18).all():
        reward += 0.25

    if results[1, 1] < 2:
        reward += 0.25
    elif results[1, 1] > 2:
        reward -= 0.3
    if results[2, 1] < 2:
        reward += 0.25
    elif results[2, 1] > 2:
        reward -= 0.3

    for i in range(3, 6):
        if results[i, 0] > 15:
            reward += 0.4
        elif results[i, 0] <= 12:
            reward -= 0.8

    for i in range(3, 6):
        if results[i, 1] >= 2:
            reward += 0.15

    if results[6, 0] >= 18:
        reward += 0.5
    else:
        reward -= 0.67

    if results[6, 1] < 2:
        reward -= 0.35

    if results[6, 2] > 7:
        reward += 0.4

    if results[7, 0] >= 16:
        reward += 0.27
    elif results[7, 0] <= 11:
        reward -= 0.33

    if results[7, 1] >= 2:
        reward += 0.28

    if results[7, 2] > 6.5:
        reward += 0.43
    else:
        reward -= 0.13

    if results[8, 0] >= 18:
        reward += 0.42
    elif results[8, 0] <= 15:
        reward -= 0.33

    if results[8, 1] >= 3:
        reward += 0.4

    if results[8, 2] > 7.2:
        reward += 0.6
    elif results[8, 2] < 4.2:
        reward -= 0.33

    if results[9, 0] > 13:
        reward += 0.26
    if results[9, 1] >= 2:
        reward += 0.17
    if results[9, 2] > 4.5:
        reward += 0.24

    if results[10, 0] > 11:
        reward += 0.21
    if results[10, 2] > 3.2:
        reward += 0.15

    if results[11, 0] > 8:
        reward += 0.08

    return reward

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

# Do not use torch.no_grad() during training
def select_top_12_and_evaluate(model, data):
    scores = model(data)  # Output shape: [250]
    _, top_indices = torch.topk(scores, 12)
    selected_arrays = data[top_indices]  # Shape: [12, 5]
    reward = rewards(selected_arrays)
    return  reward



import torch
import matplotlib.pyplot as plt

def train_model(model, optimizer, num_episodes=1000):
    loss_history = []
    reward_history = []
    count_rewards_above_threshold = 0
    count_rewards_above_threshold_cumulative = []

    reward_threshold = 0

    for episode in range(num_episodes):
        optimizer.zero_grad()

        # Generate the input array: shape (250, 5)
        input_array = generate_custom_tensor()

        # Select top 12 arrays based on the model's output probabilities
        reward_value = select_top_12_and_evaluate(model, input_array)

        # Reward should be a scalar tensor
        reward = torch.tensor(reward_value, dtype=torch.float32, requires_grad=True)

        # Define the loss: maximize reward, so we minimize negative reward
        loss = -reward  # Minimize the negative reward

        # Ensure loss is a tensor and backward pass will be correct
        loss.backward()

        # Update model weights
        optimizer.step()

        # Record loss and reward for this episode
        loss_history.append(loss.item())
        reward_history.append(reward_value)

        # Count rewards greater than the threshold
        if reward_value > reward_threshold:
            count_rewards_above_threshold += 1

        # Track cumulative count of rewards greater than the threshold
        count_rewards_above_threshold_cumulative.append(count_rewards_above_threshold)

        # Print progress every 100 episodes
        if (episode + 1) % 100 == 0:
            print(f'Episode {episode + 1}/{num_episodes}, Loss: {loss.item()}, Reward: {reward_value}')
            torch.save(model, 'full_model.pth')

    # Plot loss, rewards, and cumulative count of rewards greater than -5
    plot_loss_rewards_and_counts(loss_history, reward_history, count_rewards_above_threshold_cumulative)

    # Save the entire model after training
    torch.save(model, 'full_model.pth')
    
    # Print the number of rewards above the threshold
    print(f'Number of rewards greater than {reward_threshold}: {count_rewards_above_threshold}')


def plot_loss_rewards_and_counts(losses, rewards, count_cumulative):
    epochs = list(range(1, len(losses) + 1))

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(10, 8))

    # Plot loss on left y-axis
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Loss', color='tab:red')
    ax1.plot(epochs, losses, color='tab:red', label='Loss')
    ax1.tick_params(axis='y', labelcolor='tab:red')
    ax1.legend(loc='upper left')

    # Plot reward on the second y-axis
    ax1_twin = ax1.twinx()
    ax1_twin.set_ylabel('Reward', color='tab:blue')
    ax1_twin.plot(epochs, rewards, color='tab:blue', label='Reward')
    ax1_twin.tick_params(axis='y', labelcolor='tab:blue')
    ax1_twin.legend(loc='upper right')

    ax1.set_title('Loss and Reward over Epochs')

    # Plot cumulative count of rewards greater than -5
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Cumulative Count of Rewards > 0')
    ax2.plot(epochs, count_cumulative, color='tab:green', label='Cumulative Count > 0')
    ax2.set_title('Cumulative Count of Rewards Greater Than 0')
    ax2.legend(loc='upper left')

    plt.tight_layout()
    plt.show()


# Initialize model, optimizer, and start training
model = torch.load('full_model.pth')
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)

# Start training
train_model(model, optimizer, num_episodes=10)
